// Run slow, non-essential work (emails, notifications) AFTER the response has
// gone to the user. On Vercel the function would normally be frozen the moment
// the response ends, so the work is handed to waitUntil(), which keeps the
// function alive until it finishes. Anywhere else (local dev, a normal server)
// the promise simply keeps running after the response.
let waitUntil = null;
try { ({ waitUntil } = require('@vercel/functions')); } catch { /* not installed / not on Vercel */ }

function runInBackground(task, label = 'background task') {
  const p = Promise.resolve()
    .then(task)
    .catch(err => console.error(`Background task failed (${label}):`, err && err.message));
  if (typeof waitUntil === 'function') {
    try { waitUntil(p); } catch { /* ignore */ }
  }
  return p;
}

module.exports = { runInBackground };
