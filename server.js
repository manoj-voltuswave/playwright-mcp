require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { ApifyClient } = require('apify-client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JOBS_FILE = path.join(__dirname, 'linkedin-jobs.json');
const TRACKER_FILE = path.join(__dirname, 'job-tracker.json');

const SEARCH_URLS = [
  'https://www.linkedin.com/jobs/search/?keywords=Full%20Stack%20Developer&location=India&f_TPR=r86400&sortBy=DD',
  'https://www.linkedin.com/jobs/search/?keywords=React%20Node%20Developer&location=India&f_TPR=r86400&sortBy=DD',
  'https://www.linkedin.com/jobs/search/?keywords=MERN%20Stack%20Developer&location=India&f_TPR=r86400&sortBy=DD',
  'https://www.linkedin.com/jobs/search/?keywords=React%20Developer&location=India&f_TPR=r86400&sortBy=DD',
];

function loadTracker() {
  if (fs.existsSync(TRACKER_FILE)) {
    try { return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8')); } catch { }
  }
  return { applied: {}, skipped: {} };
}

function saveTracker(t) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(t, null, 2));
}

function loadJobs() {
  if (fs.existsSync(JOBS_FILE)) {
    try { return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8')); } catch { }
  }
  return [];
}

// ── GET /api/jobs ─────────────────────────────────────────────────────────────
app.get('/api/jobs', (req, res) => {
  const jobs = loadJobs();
  const tracker = loadTracker();
  const result = jobs.map((j, idx) => {
    const key = j.applyUrl || j.linkedinUrl || String(idx);
    return {
      ...j,
      id: key,
      status: tracker.applied[key] ? 'applied'
            : tracker.skipped[key] ? 'skipped'
            : 'pending',
      appliedAt: tracker.applied[key]?.date || null,
      skippedAt: tracker.skipped[key]?.date || null,
      notes: tracker.applied[key]?.notes || tracker.skipped[key]?.notes || '',
    };
  });
  res.json(result);
});

// ── POST /api/fetch-jobs ──────────────────────────────────────────────────────
app.post('/api/fetch-jobs', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'Apify API key is required' });

  try {
    const client = new ApifyClient({ token: apiKey });
    const allJobs = [];

    for (const url of SEARCH_URLS) {
      const label = new URL(url).searchParams.get('keywords');
      console.log(`Fetching: "${label}"...`);
      try {
        const run = await client.actor('curious_coder/linkedin-jobs-scraper').call({
          urls: [url],
          count: 50,
        });
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        for (const item of items) {
          allJobs.push({
            title: item.title || item.jobTitle || '',
            company: item.companyName || item.company || '',
            location: item.location || '',
            applyUrl: item.applyUrl || item.jobUrl || item.url || '',
            linkedinUrl: item.jobUrl || '',
            description: (item.description || '').substring(0, 600),
            postedAt: item.postedAt || item.publishedAt || '',
            easyApply: !!item.easyApplyUrl,
            easyApplyUrl: item.easyApplyUrl || '',
          });
        }
      } catch (err) {
        console.error(`Error for "${label}":`, err.message);
      }
    }

    // Deduplicate by URL
    const seen = new Set();
    const unique = allJobs.filter(j => {
      const key = j.applyUrl || j.linkedinUrl;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Merge: keep existing + add new
    const existing = loadJobs();
    const existingKeys = new Set(existing.map(j => j.applyUrl || j.linkedinUrl));
    const newJobs = unique.filter(j => !existingKeys.has(j.applyUrl || j.linkedinUrl));
    const merged = [...existing, ...newJobs];

    fs.writeFileSync(JOBS_FILE, JSON.stringify(merged, null, 2));
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
  } else if (status === 'pending') {
    delete tracker.applied[id];
    delete tracker.skipped[id];
  }

  saveTracker(tracker);
  res.json({ ok: true });
});

// ── GET /api/stats ────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const jobs = loadJobs();
  const tracker = loadTracker();
  const applied = Object.keys(tracker.applied).length;
  const skipped = Object.keys(tracker.skipped).length;
  res.json({ total: jobs.length, applied, skipped, pending: jobs.length - applied - skipped });
});

// ── DELETE /api/jobs ──────────────────────────────────────────────────────────
app.delete('/api/jobs', (req, res) => {
  fs.writeFileSync(JOBS_FILE, '[]');
  fs.writeFileSync(TRACKER_FILE, JSON.stringify({ applied: {}, skipped: {} }, null, 2));
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅  LinkedIn Job Tracker running → http://localhost:${PORT}\n`);
});
