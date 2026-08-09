// ============================================================
// ART VIBE — signs wall backend (back.artvibe.com.pl)
// One file, no dependencies, Node >= 22 (node:sqlite is built in). Runs behind
// nginx on 127.0.0.1:8787 — see av2-signs.service and the nginx conf beside it.
//
//   GET  /signs   -> { total, signs: [{ id, slot, color, text }] }
//   POST /signs   -> { text, color } -> 201 { sign } | 400 | 409 full | 429
//   GET  /healthz -> ok
//
// WHY THIS EXISTS AT ALL: the stage used to write a shared document straight
// from the browser. Every client rewrote the whole thing, so two visitors
// signing at once silently overwrote one another. No amount of client retrying
// fixes that, because read-modify-write from N browsers has no serialisation
// point.
//
// Here it does. Slot allocation and insert happen inside ONE synchronous
// SQLite transaction in a single-process server, so nothing can interleave —
// and `slot INTEGER UNIQUE` means even a second process could not double-book.
// That race is impossible rather than merely unlikely.
//
// This database is the only copy of the wall. deploy/signs-backup/ snapshots
// it on a timer; there is no second store behind it.
// ============================================================
import http from 'node:http';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.STATE_DIRECTORY || '/var/lib/av2-signs';
const DB_FILE = path.join(DATA_DIR, 'signs.db');

// Must match TOTAL_SLOTS in js/scene/signs.js — that file owns the stage
// layout, this one owns capacity. GET /signs reports it so the client's
// "N / 67 вільно" badge always quotes the number that will actually be
// enforced, even if the two drift.
const TOTAL_SLOTS = 67;
const MAX_TEXT = 24; // code points, after whitespace collapse
const COLORS = ['cream', 'gold', 'purple', 'pink', 'mint'];
const MAX_BODY = 4096;

// In-memory only, never written to disk: a transient throttle is not stored
// personal data, so the no-cookie-banner story in notes/Decisions.md survives.
// Resets on restart, which is fine — this stops a script, not a determined
// person, and a determined person is what SQL against the database is for.
const MIN_INTERVAL_MS = 30_000;
const DAY_MAX = 10;

const ALLOWED_ORIGINS = new Set([
  'https://artvibe.com.pl',
  'https://www.artvibe.com.pl',
  'https://vibe2.ton.zone',
]);

function isAllowedOrigin(origin) {
  // Any localhost port passes: dev serves the repo on 8000-8040.
  return ALLOWED_ORIGINS.has(origin)
    || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
}

// ---- validation --------------------------------------------------------

// Control, zero-width, bidi-override and BOM characters — invisible on the
// wall but able to reorder or blank what renders around them.
const INVISIBLES = /[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g;

export function sanitizeSignText(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .replace(/\s+/g, ' ')
    .replace(INVISIBLES, '')
    // combining-mark stacks (zalgo) bleed far outside a tag's slot
    .replace(/(\p{M})\p{M}+/gu, '$1')
    .trim();
  if (!cleaned) return null;
  if ([...cleaned].length > MAX_TEXT) return null;
  return cleaned;
}

export const validColor = (color) => COLORS.includes(color);

// ---- storage -----------------------------------------------------------

const db = new DatabaseSync(DB_FILE);
// WAL keeps a reader from blocking the writer. Not strictly needed at this
// scale; it costs nothing and removes a whole class of "database is locked".
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS signs (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    slot  INTEGER NOT NULL UNIQUE,
    color TEXT    NOT NULL,
    text  TEXT    NOT NULL,
    ts    INTEGER NOT NULL
  )
`);

const qAll = db.prepare('SELECT id, slot, color, text FROM signs ORDER BY id');
// Lowest free slot below the cap, in one statement so the answer and the
// insert can share a transaction.
const qFreeSlot = db.prepare(`
  WITH RECURSIVE candidate(n) AS (
    SELECT 0 UNION ALL SELECT n + 1 FROM candidate WHERE n + 1 < ?
  )
  SELECT n FROM candidate
  WHERE n NOT IN (SELECT slot FROM signs)
  ORDER BY n LIMIT 1
`);
const qInsert = db.prepare('INSERT INTO signs (slot, color, text, ts) VALUES (?, ?, ?, ?)');

/**
 * Claim a slot and store the sign, or return null when the stage is full.
 *
 * The whole body is synchronous with no `await`, so the event loop cannot run
 * another request between picking the slot and inserting it. That is the
 * serialisation point the browser-only design never had. BEGIN IMMEDIATE and
 * the UNIQUE index make it hold even if this ever runs as more than one
 * process.
 */
function claimSlot(text, color) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const free = qFreeSlot.get(TOTAL_SLOTS);
    if (!free) {
      db.exec('ROLLBACK');
      return null;
    }
    const ts = Date.now();
    const info = qInsert.run(free.n, color, text, ts);
    db.exec('COMMIT');
    return { id: Number(info.lastInsertRowid), slot: free.n, color, text };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const allSigns = () => qAll.all();

// ---- rate limiting -----------------------------------------------------

const seen = new Map(); // ip -> { last, day: [timestamps] }

function rateLimited(ip) {
  const now = Date.now();
  const entry = seen.get(ip) || { last: 0, day: [] };
  entry.day = entry.day.filter((t) => now - t < 86_400_000);
  if (now - entry.last < MIN_INTERVAL_MS || entry.day.length >= DAY_MAX) {
    seen.set(ip, entry);
    return true;
  }
  entry.last = now;
  entry.day.push(now);
  seen.set(ip, entry);
  return false;
}

// ---- http --------------------------------------------------------------

function send(res, status, payload, origin) {
  const headers = { 'content-type': 'application/json; charset=utf-8' };
  if (origin && isAllowedOrigin(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

/** Form-encoded keeps the browser's POST a "simple" CORS request, so there is
 *  no preflight round trip. JSON is accepted too, for curl. */
function parseBody(raw, type) {
  if ((type || '').includes('application/json')) {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': isAllowedOrigin(origin) ? origin : 'null',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
      vary: 'Origin',
    });
    res.end();
    return;
  }

  if (url.pathname === '/healthz') {
    send(res, 200, { ok: true, signs: allSigns().length, total: TOTAL_SLOTS }, origin);
    return;
  }

  if (url.pathname !== '/signs') {
    send(res, 404, { ok: false, reason: 'not found' }, origin);
    return;
  }

  if (req.method === 'GET') {
    send(res, 200, { total: TOTAL_SLOTS, signs: allSigns() }, origin);
    return;
  }

  if (req.method !== 'POST') {
    send(res, 405, { ok: false, reason: 'method' }, origin);
    return;
  }

  if (origin && !isAllowedOrigin(origin)) {
    send(res, 403, { ok: false, reason: 'origin' }, origin);
    return;
  }

  let body;
  try {
    body = parseBody(await readBody(req), req.headers['content-type']);
  } catch {
    send(res, 413, { ok: false, reason: 'too large' }, origin);
    return;
  }

  const text = sanitizeSignText(body.text);
  const color = body.color;
  if (!text || !validColor(color)) {
    send(res, 400, { ok: false, reason: 'invalid' }, origin);
    return;
  }

  const ip = (req.headers['x-real-ip'] || req.socket.remoteAddress || '').toString();
  if (rateLimited(ip)) {
    send(res, 429, { ok: false, reason: 'rate' }, origin);
    return;
  }

  let sign;
  try {
    sign = claimSlot(text, color);
  } catch (err) {
    console.error('claim failed:', err.message);
    send(res, 500, { ok: false, reason: 'store' }, origin);
    return;
  }
  if (!sign) {
    send(res, 409, { ok: false, reason: 'full' }, origin);
    return;
  }

  send(res, 201, { ok: true, sign, total: TOTAL_SLOTS }, origin);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`av2-signs listening on 127.0.0.1:${PORT} (${allSigns().length} signs, cap ${TOTAL_SLOTS})`);
});
