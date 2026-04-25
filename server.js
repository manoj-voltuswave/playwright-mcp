const express = require('express');
const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch {}

const { ApifyClient } = require('apify-client');

const app = express();
app.use(express.json());

const JOBS_FILE    = path.join(__dirname, 'linkedin-jobs.json');
const TRACKER_FILE = path.join(__dirname, 'job-tracker.json');
const CONFIG_FILE  = path.join(__dirname, 'config.json');

const SEARCH_URLS = [
  'https://www.linkedin.com/jobs/search/?keywords=Full%20Stack%20Developer&location=India&f_TPR=r86400&sortBy=DD',
  'https://www.linkedin.com/jobs/search/?keywords=React%20Node%20Developer&location=India&f_TPR=r86400&sortBy=DD',
  'https://www.linkedin.com/jobs/search/?keywords=MERN%20Stack%20Developer&location=India&f_TPR=r86400&sortBy=DD',
  'https://www.linkedin.com/jobs/search/?keywords=React%20Developer&location=India&f_TPR=r86400&sortBy=DD',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
const loadJobs    = () => fs.existsSync(JOBS_FILE)    ? readJson(JOBS_FILE, [])                          : [];
const loadTracker = () => fs.existsSync(TRACKER_FILE) ? readJson(TRACKER_FILE, { applied:{}, skipped:{} }) : { applied:{}, skipped:{} };
const loadConfig  = () => fs.existsSync(CONFIG_FILE)  ? readJson(CONFIG_FILE, {})                         : {};

// ── GET /api/config ───────────────────────────────────────────────────────────
app.get('/api/config', (_req, res) => {
  res.json(loadConfig());
});

// ── POST /api/config ──────────────────────────────────────────────────────────
app.post('/api/config', (req, res) => {
  const cfg = loadConfig();
  if (req.body.apifyKey !== undefined) cfg.apifyKey = req.body.apifyKey;
  writeJson(CONFIG_FILE, cfg);
  res.json({ ok: true });
});

// ── GET /api/jobs ─────────────────────────────────────────────────────────────
app.get('/api/jobs', (_req, res) => {
  const jobs    = loadJobs();
  const tracker = loadTracker();
  res.json(jobs.map((j, idx) => {
    const key = j.apifyUrl || j.applyUrl || j.linkedinUrl || String(idx);
    return {
      ...j,
      id:        key,
      status:    tracker.applied[key] ? 'applied' : tracker.skipped[key] ? 'skipped' : 'pending',
      appliedAt: tracker.applied[key]?.date  || null,
      skippedAt: tracker.skipped[key]?.date  || null,
      notes:     tracker.applied[key]?.notes || tracker.skipped[key]?.notes || '',
    };
  }));
});

// ── GET /api/stats ────────────────────────────────────────────────────────────
app.get('/api/stats', (_req, res) => {
  const jobs    = loadJobs();
  const tracker = loadTracker();
  const applied = Object.keys(tracker.applied).length;
  const skipped = Object.keys(tracker.skipped).length;
  res.json({ total: jobs.length, applied, skipped, pending: jobs.length - applied - skipped });
});

// ── POST /api/fetch-jobs ──────────────────────────────────────────────────────
app.post('/api/fetch-jobs', async (req, res) => {
  const apiKey = req.body.apiKey || loadConfig().apifyKey;
  if (!apiKey) return res.status(400).json({ error: 'Apify API key is required' });

  // Save the key for future use
  const cfg = loadConfig();
  cfg.apifyKey = apiKey;
  writeJson(CONFIG_FILE, cfg);

  try {
    const client  = new ApifyClient({ token: apiKey });
    const allJobs = [];

    for (const url of SEARCH_URLS) {
      const label = new URL(url).searchParams.get('keywords');
      console.log(`Fetching: "${label}"...`);
      try {
        const run = await client.actor('curious_coder/linkedin-jobs-scraper').call({ urls: [url], count: 50 });
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        for (const item of items) {
          allJobs.push({
            title:       item.title       || item.jobTitle    || '',
            company:     item.companyName || item.company     || '',
            location:    item.location    || '',
            applyUrl:    item.applyUrl    || item.jobUrl      || item.url || '',
            linkedinUrl: item.jobUrl      || '',
            description: (item.description || '').substring(0, 600),
            postedAt:    item.postedAt    || item.publishedAt || '',
            easyApply:   !!item.easyApplyUrl,
            easyApplyUrl: item.easyApplyUrl || '',
          });
        }
      } catch (err) { console.error(`  Error "${label}":`, err.message); }
    }

    // Deduplicate
    const seen = new Set();
    const unique = allJobs.filter(j => {
      const k = j.applyUrl || j.linkedinUrl;
      if (!k || seen.has(k)) return false;
      seen.add(k); return true;
    });

    // Merge with existing (keep old + add new)
    const existing     = loadJobs();
    const existingKeys = new Set(existing.map(j => j.applyUrl || j.linkedinUrl));
    const newJobs      = unique.filter(j => !existingKeys.has(j.applyUrl || j.linkedinUrl));
    const merged       = [...existing, ...newJobs];
    writeJson(JOBS_FILE, merged);

    res.json({ total: merged.length, added: newJobs.length, fetched: unique.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/status ──────────────────────────────────────────────────────────
app.post('/api/status', (req, res) => {
  const { id, status, notes } = req.body;
  if (!id || !status) return res.status(400).json({ error: 'id and status required' });

  const tracker = loadTracker();
  if (status === 'applied') {
    tracker.applied[id] = { date: new Date().toISOString(), notes: notes || '' };
    delete tracker.skipped[id];
  } else if (status === 'skipped') {
    tracker.skipped[id] = { date: new Date().toISOString(), notes: notes || '' };
    delete tracker.applied[id];
  } else {
    delete tracker.applied[id];
    delete tracker.skipped[id];
  }
  writeJson(TRACKER_FILE, tracker);
  res.json({ ok: true });
});

// ── DELETE /api/jobs ──────────────────────────────────────────────────────────
app.delete('/api/jobs', (_req, res) => {
  writeJson(JOBS_FILE, []);
  writeJson(TRACKER_FILE, { applied: {}, skipped: {} });
  res.json({ ok: true });
});

// ── Serve UI (AFTER all API routes) ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`\n✅  LinkedIn Job Tracker → http://localhost:${PORT}\n`));
