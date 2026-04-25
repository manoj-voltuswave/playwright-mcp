/**
 * track-jobs.js
 * Manages the Excel tracker for job applications.
 * Applied, failed, and skipped jobs are all logged here.
 *
 * Usage (from apply scripts or Claude):
 *   const tracker = require('./track-jobs');
 *   tracker.logApplied({ title, company, location, url, notes });
 *   tracker.logFailed({ title, company, location, url, reason });
 *   tracker.logSkipped({ title, company, location, url, reason });
 *   tracker.save();
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'job-applications.xlsx');

const SHEETS = {
  applied:  { name: 'Applied',  rows: [] },
  failed:   { name: 'Failed',   rows: [] },
  skipped:  { name: 'Skipped',  rows: [] },
};

const HEADERS = ['#', 'Date', 'Job Title', 'Company', 'Location', 'Apply URL', 'Notes / Reason'];

function now() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

// Load existing workbook if present
let wb;
let counters = { applied: 0, failed: 0, skipped: 0 };
if (fs.existsSync(FILE)) {
  wb = XLSX.readFile(FILE);
  for (const key of Object.keys(SHEETS)) {
    const ws = wb.Sheets[SHEETS[key].name];
    if (ws) {
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      SHEETS[key].rows = rows.length > 1 ? rows.slice(1) : [];
      counters[key] = SHEETS[key].rows.length;
    }
  }
} else {
  wb = XLSX.utils.book_new();
}

function addRow(sheetKey, { title = '', company = '', location = '', url = '', notes = '' }) {
  counters[sheetKey]++;
  SHEETS[sheetKey].rows.push([counters[sheetKey], now(), title, company, location, url, notes]);
}

function save() {
  for (const key of Object.keys(SHEETS)) {
    const data = [HEADERS, ...SHEETS[key].rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    // Column widths
    ws['!cols'] = [{ wch: 4 }, { wch: 20 }, { wch: 35 }, { wch: 30 }, { wch: 20 }, { wch: 60 }, { wch: 50 }];
    if (wb.SheetNames.includes(SHEETS[key].name)) {
      wb.Sheets[SHEETS[key].name] = ws;
    } else {
      XLSX.utils.book_append_sheet(wb, ws, SHEETS[key].name);
    }
  }
  XLSX.writeFile(wb, FILE);
  console.log(`Tracker saved → ${FILE}`);
}

function logApplied(job) { addRow('applied', job); }
function logFailed(job)  { addRow('failed',  { ...job, notes: job.reason || job.notes || '' }); }
function logSkipped(job) { addRow('skipped', { ...job, notes: job.reason || job.notes || '' }); }

function summary() {
  return `Applied: ${counters.applied}  Failed: ${counters.failed}  Skipped: ${counters.skipped}`;
}

module.exports = { logApplied, logFailed, logSkipped, save, summary, FILE };
