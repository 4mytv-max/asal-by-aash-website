const express = require('express');
const multer = require('multer');
const path = require('path');

const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'asal2026';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// --- Database: Turso (permanent) with local SQLite fallback for dev ---
// On Render, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars.
// Without them the app falls back to a local asal.db file (dev only —
// Render's disk is ephemeral, so local data is lost on redeploy).
const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';
const USE_TURSO = Boolean(TURSO_URL && TURSO_TOKEN);

let db;
if (USE_TURSO) {
  const { createClient } = require('@libsql/client');
  db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  console.log('Using Turso database (permanent storage)');
} else {
  const { DatabaseSync } = require('node:sqlite');
  const localDb = new DatabaseSync(path.join(__dirname, 'asal.db'));
  localDb.exec('PRAGMA journal_mode = WAL;');
  // Wrap sync node:sqlite in the async @libsql/client shape:
  //   execute(string | {sql, args}) -> { rows, rowsAffected, lastInsertRowid }
  //   batch([...]) -> array of execute results
  db = {
    async execute(sqlOrObj) {
      const sql = typeof sqlOrObj === 'string' ? sqlOrObj : sqlOrObj.sql;
      const args = typeof sqlOrObj === 'string' ? [] : (sqlOrObj.args || []);
      if (/^\s*(SELECT|PRAGMA|WITH|EXPLAIN|VALUES)\b/i.test(sql)) {
        return { rows: localDb.prepare(sql).all(...args), rowsAffected: 0, lastInsertRowid: 0 };
      }
      const info = localDb.prepare(sql).run(...args);
      return { rows: [], rowsAffected: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
    },
    async batch(stmts) {
      const out = [];
      for (const s of stmts) out.push(await this.execute(s));
      return out;
    },
  };
  console.log('Using local SQLite (dev only — data will NOT persist on Render redeploys)');
}

// Async wrapper for Express 4 route handlers (forwards rejections to the error middleware)
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// libsql may return BigInts for integer columns; normalize for JSON responses
const num = (v) => (typeof v === 'bigint' ? Number(v) : v);

// Run statements transactionally on both backends.
// (Turso does not hold transactions across separate HTTP execute() calls,
// so use db.batch() there; local SQLite uses BEGIN/COMMIT.)
async function execBatch(stmts) {
  const norm = stmts.map((s) => {
    if (typeof s === 'string') return { sql: s, args: [] };
    if (Array.isArray(s)) return { sql: s[0], args: s.slice(1) };
    return { sql: s.sql, args: s.args || [] };
  });
  if (!norm.length) return;
  if (USE_TURSO) {
    await db.batch(norm);
  } else {
    await db.execute('BEGIN');
    try {
      for (const s of norm) await db.execute(s);
      await db.execute('COMMIT');
    } catch (e) {
      try { await db.execute('ROLLBACK'); } catch (_) { /* ignore */ }
      throw e;
    }
  }
}

// --- Schema ---
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS fabric_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fabric_name TEXT NOT NULL,
    fabric_image_key TEXT,
    model_1_name TEXT NOT NULL,
    model_1_image_key TEXT,
    model_1_price TEXT,
    model_2_name TEXT NOT NULL,
    model_2_image_key TEXT,
    model_2_price TEXT,
    model_3_name TEXT NOT NULL,
    model_3_image_key TEXT,
    model_3_price TEXT,
    model_4_name TEXT NOT NULL,
    model_4_image_key TEXT,
    model_4_price TEXT,
    sample_asset TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS site_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    stars INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    UNIQUE(device_id)
  )`,
  `CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_hash TEXT,
    user_agent TEXT,
    visited_at INTEGER NOT NULL,
    path TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_visits_at ON visits (visited_at)`,
  // Uploaded images live IN the database so they survive Render redeploys.
  `CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    mime TEXT NOT NULL DEFAULT 'image/jpeg',
    created_at INTEGER NOT NULL
  )`,
];

// --- Seed data ---
const SITE_CONTENT_SEED = {
  welcome_message: '✨ Welcome to ASAL by Aash — Custom-stitched comfort wear, made for you ✨',
  trust_strip_text: '✨ FABRIC IN STOCK ✨ Despatch in 7 Days ✨ Pan India Delivery ✨ 100% Pure Cotton ✨ Custom Stitching ✨ One Piece Per Fabric — No More Copies ✨ Unique ✨',
  hero_eyebrow: 'Our fabric, your design',
  hero_headline: 'Our fabric or Yours\n<em>Our design or Yours</em>',
  hero_body: 'Comfort wear, custom-stitched to your exact measurements.',
  custom_sizing_line: 'No Generic Sizes — Your Size, Your Choice',
  browse_catalog_button: 'Browse WhatsApp catalog',
  whatsapp_catalog_button: 'WhatsApp catalog',
  process_title: 'How It Works',
  step_1_number: '01',
  step_1_title: 'CHOOSE FABRIC',
  step_1_subtitle: 'Pick from our fabrics, or send us your own.',
  step_2_number: '02',
  step_2_title: 'PICK A STYLE',
  step_2_subtitle: 'From our samples, or send your own design.',
  step_3_number: '03',
  step_3_title: 'SHARE MEASUREMENTS',
  step_3_subtitle: 'Send your measurements on WhatsApp.',
  step_4_number: '04',
  step_4_title: 'STITCHED & DELIVERED',
  step_4_subtitle: 'Stitched with care, despatched in 7 days.',
  catalog_eyebrow: 'Fabric collections',
  catalog_body: 'Tap any photo to view it up close.',
  catalog_samples_note: "These designs are just samples to inspire you. Have a design in mind? Send it to us on WhatsApp — we'll stitch it for you in the fabric you select, or in your own fabric, to your measurements.",
  fabric_badge: 'FABRIC IN STOCK',
  fabric_status: 'Fabric in stock · style ideas shown',
  fabric_order_button: 'Ask about this fabric',
  order_button: 'Order on WhatsApp',
  view_button: 'View',
  material_label: 'Available fabric',
  model_context_label: 'Style inspiration · fabric only',
  made_eyebrow: 'Your fabric, your style',
  made_headline: 'Start with the fabric you love.',
  made_body: 'Select a fabric, explore the style ideas, then continue on WhatsApp to order the fabric and discuss your custom stitching.',
  trust_badge_1: 'Despatch in 7 days',
  trust_badge_2: 'Pan India delivery',
  trust_badge_3: '100% Pure Cotton',
  trust_badge_4: 'Stitched to Your Measurements',
  trust_badge_5: 'One Piece Only',
  bulk_orders_note: 'We accept bulk orders for celebrations & family functions — contact us on WhatsApp.',
  faq_eyebrow: 'Need to know',
  faq_title: 'Frequently asked questions',
  faq_q1: 'How do I share my measurements?',
  faq_a1: 'Just send your measurements on WhatsApp.',
  faq_q2: 'How long does it take?',
  faq_a2: 'We despatch within 7 days.',
  faq_q3: 'I have my own fabric, will you stitch it?',
  faq_a3: "Yes! Send us your fabric — we'll stitch it to your measurements and send it back.",
  faq_q4: "What if I don't have fabric?",
  faq_a4: 'Choose from our fabrics.',
  faq_q5: 'Where do you deliver?',
  faq_a5: 'Pan India delivery.',
  cta_strip_text: '✨ Ready for custom comfort? ✨ Order on WhatsApp ✨ Our fabric or Yours ✨',
  rating_eyebrow: 'Your experience',
  rating_title: 'Rate our website',
  rating_prompt: 'Tap one star to five stars. You can rate once on this device.',
  footer_left: '© 2026 ASAL by Aash. All rights reserved.',
  footer_right: 'ASAL by Aash - Custom made comfort wear',
  footer_tagline: 'Comfort + customization + affordable everyday fashion',
};

const CATALOG_SEED = [
  { fabric: 'Magenta Golden Floral Print', slug: 'row1-magenta-golden' },
  { fabric: 'Teal White Floral Print', slug: 'row2-teal-white-floral' },
  { fabric: 'Rust White Vine Print', slug: 'row3-rust-white-vine' },
  { fabric: 'Teal White Vine Print', slug: 'row4-teal-white-vine' },
  { fabric: 'Royal Blue Vine Print', slug: 'row5-royal-blue-vine' },
  { fabric: 'Black Pink Floral Print', slug: 'row6-black-pink-floral' },
  { fabric: 'Beige Maroon Floral Print', slug: 'row7-beige-maroon', ext: 'webp' },
];

const MODEL_NAMES = ['Coat Collar Kurti', 'Frock Nighty', 'V-Neck Short Kurti', 'Nighty'];
const MODEL_SLUGS = ['coat-collar-kurti', 'frock-nighty', 'v-neck-short-kurti', 'nighty'];

async function seedIfEmpty() {
  const contentCount = num((await db.execute('SELECT COUNT(*) AS c FROM site_content')).rows[0].c);
  if (contentCount === 0) {
    await execBatch(Object.entries(SITE_CONTENT_SEED).map(([k, v]) => ({
      sql: 'INSERT INTO site_content (key, value) VALUES (?, ?)', args: [k, v],
    })));
    console.log('Seeded site_content');
  }
  // 2026-10-19 migration (user): headline "Ours first" — only touches default values
  await db.execute({
    sql: "UPDATE site_content SET value = ? WHERE key = 'hero_headline' AND value IN (?, ?, ?)",
    args: ['Our fabric or Yours\n<em>Our design or Yours</em>',
           'Your Fabric or Ours.\nYour Design or Ours.',
           'Our fabric or Yours\nOur design or Yours',
           'Your Fabric or Ours.\n<em>Your Design or Ours.</em>'],
  });
  await db.execute({
    sql: "UPDATE site_content SET value = REPLACE(value, 'Your Fabric or Ours', 'Our fabric or Yours') WHERE key = 'cta_strip_text'",
  });
  const rowCount = num((await db.execute('SELECT COUNT(*) AS c FROM fabric_rows')).rows[0].c);
  if (rowCount === 0) {
    await execBatch(CATALOG_SEED.map((r) => {
      const ext = r.ext || 'jpg';
      return {
        sql: `INSERT INTO fabric_rows
          (fabric_name, fabric_image_key, model_1_name, model_1_image_key, model_2_name, model_2_image_key,
           model_3_name, model_3_image_key, model_4_name, model_4_image_key)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          r.fabric,
          `/images/catalog/${r.slug}-fabric.${ext}`,
          MODEL_NAMES[0], `/images/catalog/${r.slug}-${MODEL_SLUGS[0]}.${ext}`,
          MODEL_NAMES[1], `/images/catalog/${r.slug}-${MODEL_SLUGS[1]}.${ext}`,
          MODEL_NAMES[2], `/images/catalog/${r.slug}-${MODEL_SLUGS[2]}.${ext}`,
          MODEL_NAMES[3], `/images/catalog/${r.slug}-${MODEL_SLUGS[3]}.${ext}`,
        ],
      };
    }));
    console.log('Seeded fabric_rows');
  }
}

// --- Migration: unlimited model photos + row ordering ---
// One-time backfill, keyed on models_json IS NULL (idempotent across restarts).
// Rows that already have models_json are never touched again, so a user-defined
// sort_order is never clobbered by a later restart.
async function migrateModelsJson() {
  const cols = (await db.execute('PRAGMA table_info(fabric_rows)')).rows.map((c) => c.name);
  if (!cols.includes('sort_order')) await db.execute('ALTER TABLE fabric_rows ADD COLUMN sort_order INTEGER DEFAULT 0');
  if (!cols.includes('models_json')) await db.execute('ALTER TABLE fabric_rows ADD COLUMN models_json TEXT');
  const legacyRows = (await db.execute('SELECT * FROM fabric_rows WHERE models_json IS NULL')).rows;
  if (legacyRows.length) {
    await execBatch(legacyRows.map((r) => {
      const models = [];
      for (let i = 1; i <= 4; i++) {
        const name = r[`model_${i}_name`];
        if (name) models.push({ name, image_key: r[`model_${i}_image_key`] || '', price: r[`model_${i}_price`] || '' });
      }
      // sort_order = id preserves original id order
      return { sql: 'UPDATE fabric_rows SET sort_order = ?, models_json = ? WHERE id = ?', args: [num(r.id), JSON.stringify(models), num(r.id)] };
    }));
    console.log(`Migrated ${legacyRows.length} fabric row(s) to models_json + sort_order`);
  }
}

async function initDb() {
  for (const sql of SCHEMA_STATEMENTS) await db.execute(sql);
  await seedIfEmpty();
  await migrateModelsJson();
}

// --- Middleware ---
app.set('trust proxy', 1); // Render sits behind a proxy — req.ip gives the real client IP

// --- Security headers (helmet) ---
// CSP disabled for now (site uses inline scripts/styles + Google Fonts);
// all other helmet protections (HSTS, X-Frame-Options, etc.) are active.
app.use(helmet({ contentSecurityPolicy: false }));

// --- Rate limiting ---
// Strict limiter for the owner login: blocks brute-force password guessing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});
// General API limiter: generous, just stops floods.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '2mb' }));
app.use('/api/', apiLimiter);

// Visitor analytics: log page views of the homepage only (no API, no static assets).
// Privacy: stores only a SHA256 hash (first 16 chars) of the IP, never the raw IP. No cookies.
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path === '/') {
    try {
      const ip = req.ip || '';
      const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
      const ua = (req.get('user-agent') || '').slice(0, 256);
      db.execute({
        sql: 'INSERT INTO visits (ip_hash, user_agent, visited_at, path) VALUES (?, ?, ?, ?)',
        args: [ipHash, ua, Date.now(), req.path],
      }).catch(() => { /* analytics must never break the page */ });
    } catch (e) { /* analytics must never break the page */ }
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

// Uploads: files are kept in memory and stored IN the database (images table),
// so they survive Render redeploys (Render's disk is ephemeral).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});
// Legacy disk-upload dir (local dev only; kept for the suggest-name fallback below)
const uploadDir = path.join(__dirname, 'public', 'images', 'uploads');

// --- Admin auth (simple token) ---
// Deterministic admin token derived from password — survives server restarts
// (Render free plan restarts wipe in-memory state).
function adminToken() {
  return crypto.createHash('sha256').update('asal-admin|' + OWNER_PASSWORD).digest('hex');
}
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token && token === adminToken()) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Visitor stats use IST day boundaries — the business is India-based
const IST_OFFSET_MS = 5.5 * 3600 * 1000;

// --- Public API ---
function rowModels(r) {
  // Prefer models_json (unlimited models); fall back to legacy model_1..4 columns.
  let models = [];
  try {
    if (r.models_json) {
      const parsed = JSON.parse(r.models_json);
      if (Array.isArray(parsed)) models = parsed.filter(m => m && typeof m.name === 'string' && m.name);
    }
  } catch (e) { /* fall through to legacy columns */ }
  if (!models.length) {
    for (let i = 1; i <= 4; i++) {
      const name = r[`model_${i}_name`];
      if (name) models.push({ name, image_key: r[`model_${i}_image_key`] || '', price: r[`model_${i}_price`] || '' });
    }
  }
  return models;
}
function rowToJson(r) {
  const models = rowModels(r);
  return {
    id: num(r.id),
    fabric_name: r.fabric_name,
    fabric_image_url: r.fabric_image_key,
    model_names: models.map(m => m.name),
    model_image_urls: models.map(m => m.image_key || ''),
    model_prices: models.map(m => m.price || ''),
  };
}

app.get('/api/catalog', ah(async (req, res) => {
  const rows = (await db.execute('SELECT * FROM fabric_rows ORDER BY sort_order ASC, id ASC')).rows;
  res.json({ rows: rows.map(rowToJson) });
}));

app.get('/api/content', ah(async (req, res) => {
  const rows = (await db.execute('SELECT key, value FROM site_content')).rows;
  const content = {};
  for (const r of rows) content[r.key] = r.value;
  res.json({ content });
}));

app.get('/api/rating', ah(async (req, res) => {
  const agg = (await db.execute('SELECT COUNT(*) AS count, AVG(stars) AS avg FROM site_ratings')).rows[0];
  const count = num(agg.count);
  res.json({
    average: count ? Math.round(num(agg.avg) * 10) / 10 : 0,
    count,
  });
}));

app.post('/api/rating', ah(async (req, res) => {
  const { stars, deviceId } = req.body || {};
  if (!Number.isInteger(stars) || stars < 1 || stars > 5)
    return res.status(400).json({ error: 'Stars must be 1-5' });
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 128)
    return res.status(400).json({ error: 'deviceId required' });
  try {
    await db.execute({ sql: 'INSERT INTO site_ratings (device_id, stars) VALUES (?, ?)', args: [deviceId, stars] });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE constraint failed'))
      return res.status(409).json({ error: 'Already rated on this device' });
    throw e;
  }
  const agg = (await db.execute('SELECT COUNT(*) AS count, AVG(stars) AS avg FROM site_ratings')).rows[0];
  res.json({ average: Math.round(num(agg.avg) * 10) / 10, count: num(agg.count) });
}));

// --- Admin API ---
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (password === OWNER_PASSWORD) {
    res.json({ token: adminToken() });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

app.get('/api/admin/stats', requireAdmin, ah(async (req, res) => {
  const now = Date.now();
  const istMidnightUtc = Math.floor((now + IST_OFFSET_MS) / 86400000) * 86400000 - IST_OFFSET_MS;
  const thirtyDaysAgo = now - 30 * 86400000;

  const total = num((await db.execute('SELECT COUNT(*) AS c FROM visits')).rows[0].c);
  const today = num((await db.execute({ sql: 'SELECT COUNT(*) AS c FROM visits WHERE visited_at >= ?', args: [istMidnightUtc] })).rows[0].c);
  const unique = num((await db.execute('SELECT COUNT(DISTINCT ip_hash) AS c FROM visits')).rows[0].c);
  const byDay = (await db.execute({
    sql: `SELECT date(visited_at / 1000, 'unixepoch', '+330 minutes') AS date, COUNT(*) AS count
      FROM visits WHERE visited_at >= ? GROUP BY date ORDER BY date ASC`,
    args: [thirtyDaysAgo],
  })).rows.map((r) => ({ date: r.date, count: num(r.count) }));

  res.json({
    total_visits: total,
    today_visits: today,
    unique_visitors: unique,
    visits_by_day: byDay,
  });
}));

app.get('/api/admin/catalog', requireAdmin, ah(async (req, res) => {
  const rows = (await db.execute('SELECT * FROM fabric_rows ORDER BY sort_order ASC, id ASC')).rows;
  res.json({ rows: rows.map(rowToJson) });
}));

// Build the canonical models array (any length) from the three parallel input arrays.
function buildModels(namesIn, imgsIn, pricesIn) {
  const names = Array.isArray(namesIn) && namesIn.length ? namesIn : MODEL_NAMES.slice();
  const imgs = Array.isArray(imgsIn) ? imgsIn : [];
  const prices = Array.isArray(pricesIn) ? pricesIn : [];
  const count = Math.max(names.length, imgs.length, prices.length, 4);
  const models = [];
  for (let i = 0; i < count; i++) {
    const rawName = typeof names[i] === 'string' ? names[i].trim() : '';
    const name = rawName || (i < MODEL_NAMES.length ? MODEL_NAMES[i] : `Model ${i + 1}`);
    models.push({ name, image_key: imgs[i] || '', price: prices[i] || '' });
  }
  return models;
}

app.post('/api/admin/catalog', requireAdmin, ah(async (req, res) => {
  const { fabric_name, fabric_image_url, model_names, model_image_urls, model_prices } = req.body || {};
  if (!fabric_name) return res.status(400).json({ error: 'fabric_name required' });
  const models = buildModels(model_names, model_image_urls, model_prices);
  const m = (i) => models[i] || { name: MODEL_NAMES[i] || `Model ${i + 1}`, image_key: '', price: '' };
  const nextOrder = num((await db.execute('SELECT COALESCE(MAX(sort_order), 0) AS mx FROM fabric_rows')).rows[0].mx) + 1;
  const result = await db.execute({
    sql: `INSERT INTO fabric_rows
      (fabric_name, fabric_image_key, model_1_name, model_1_image_key, model_1_price,
       model_2_name, model_2_image_key, model_2_price, model_3_name, model_3_image_key, model_3_price,
       model_4_name, model_4_image_key, model_4_price, sort_order, models_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [fabric_name, fabric_image_url || '',
      m(0).name, m(0).image_key, m(0).price,
      m(1).name, m(1).image_key, m(1).price,
      m(2).name, m(2).image_key, m(2).price,
      m(3).name, m(3).image_key, m(3).price,
      nextOrder, JSON.stringify(models)],
  });
  const row = (await db.execute({ sql: 'SELECT * FROM fabric_rows WHERE id = ?', args: [num(result.lastInsertRowid)] })).rows[0];
  res.json({ row: rowToJson(row) });
}));

app.put('/api/admin/catalog/:id', requireAdmin, ah(async (req, res) => {
  const id = Number(req.params.id);
  const { fabric_name, fabric_image_url, model_names, model_image_urls, model_prices } = req.body || {};
  const existing = (await db.execute({ sql: 'SELECT * FROM fabric_rows WHERE id = ?', args: [id] })).rows[0];
  if (!existing) return res.status(404).json({ error: 'Not found' });
  // Fall back to the row's existing full models (never truncate to 4 on a partial edit).
  const cur = rowModels(existing);
  const names = Array.isArray(model_names) && model_names.length ? model_names : cur.map(m => m.name);
  const imgs = Array.isArray(model_image_urls) && model_image_urls.length ? model_image_urls : cur.map(m => m.image_key);
  const prices = Array.isArray(model_prices) && model_prices.length ? model_prices : cur.map(m => m.price);
  const models = buildModels(names, imgs, prices);
  const m = (i) => models[i] || { name: MODEL_NAMES[i] || `Model ${i + 1}`, image_key: '', price: '' };
  await db.execute({
    sql: `UPDATE fabric_rows SET fabric_name=?, fabric_image_key=?,
      model_1_name=?, model_1_image_key=?, model_1_price=?,
      model_2_name=?, model_2_image_key=?, model_2_price=?,
      model_3_name=?, model_3_image_key=?, model_3_price=?,
      model_4_name=?, model_4_image_key=?, model_4_price=?,
      models_json=? WHERE id=?`,
    args: [fabric_name ?? existing.fabric_name, fabric_image_url ?? existing.fabric_image_key,
      m(0).name, m(0).image_key, m(0).price, m(1).name, m(1).image_key, m(1).price,
      m(2).name, m(2).image_key, m(2).price, m(3).name, m(3).image_key, m(3).price,
      JSON.stringify(models), id],
  });
  const row = (await db.execute({ sql: 'SELECT * FROM fabric_rows WHERE id = ?', args: [id] })).rows[0];
  res.json({ row: rowToJson(row) });
}));

// Restore the 7 original seed fabrics (skips ones already present by name)
app.post('/api/admin/catalog/restore-seed', requireAdmin, ah(async (req, res) => {
  const existing = (await db.execute('SELECT fabric_name FROM fabric_rows')).rows.map(r => r.fabric_name);
  const toAdd = CATALOG_SEED.filter(s => !existing.includes(s.fabric));
  const maxOrder = num((await db.execute('SELECT COALESCE(MAX(sort_order), 0) AS mx FROM fabric_rows')).rows[0].mx);
  let added = 0;
  for (const r of toAdd) {
    const ext = r.ext || 'jpg';
    const models = MODEL_NAMES.map((mn, i) => ({
      name: mn,
      image_key: `/images/catalog/${r.slug}-${MODEL_SLUGS[i]}.${ext}`,
      price: '',
    }));
    await db.execute({
      sql: `INSERT INTO fabric_rows
        (fabric_name, fabric_image_key, model_1_name, model_1_image_key, model_2_name, model_2_image_key,
         model_3_name, model_3_image_key, model_4_name, model_4_image_key, models_json, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.fabric, `/images/catalog/${r.slug}-fabric.${ext}`,
        models[0].name, models[0].image_key, models[1].name, models[1].image_key,
        models[2].name, models[2].image_key, models[3].name, models[3].image_key,
        JSON.stringify(models), maxOrder + added + 1,
      ],
    });
    added++;
  }
  res.json({ restored: added, total: toAdd.length });
}));

app.post('/api/admin/catalog/reorder', requireAdmin, ah(async (req, res) => {
  const { order } = req.body || {};
  if (!Array.isArray(order) || !order.length)
    return res.status(400).json({ error: 'order must be a non-empty array of row ids' });
  const ids = [];
  const seen = new Set();
  for (const v of order) {
    const id = Number(v);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id); ids.push(id);
  }
  if (!ids.length) return res.status(400).json({ error: 'no valid row ids in order' });
  const existingIds = new Set((await db.execute('SELECT id FROM fabric_rows')).rows.map(r => num(r.id)));
  const stmts = [];
  ids.forEach((id, idx) => { if (existingIds.has(id)) stmts.push({ sql: 'UPDATE fabric_rows SET sort_order = ? WHERE id = ?', args: [idx, id] }); });
  await execBatch(stmts);
  res.json({ ok: true });
}));

app.delete('/api/admin/catalog/:id', requireAdmin, ah(async (req, res) => {
  const result = await db.execute({ sql: 'DELETE FROM fabric_rows WHERE id = ?', args: [Number(req.params.id)] });
  res.json({ deleted: num(result.rowsAffected) });
}));

app.put('/api/admin/content', requireAdmin, ah(async (req, res) => {
  const { content } = req.body || {};
  if (!content || typeof content !== 'object') return res.status(400).json({ error: 'content object required' });
  await execBatch(Object.entries(content).map(([k, v]) => ({
    sql: 'INSERT INTO site_content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    args: [k, String(v ?? '')],
  })));
  res.json({ ok: true });
}));

// Upload an image: stored IN the database (images table) so it survives redeploys.
// Returns { url: '/api/img/<id>' } — the frontend stores this URL in the catalog row.
app.post('/api/admin/upload', requireAdmin, upload.single('image'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const id = 'img_' + Date.now().toString(36) + '_' + crypto.randomBytes(6).toString('hex');
  const mime = req.file.mimetype || 'image/jpeg';
  await db.execute({
    sql: 'INSERT INTO images (id, data, mime, created_at) VALUES (?, ?, ?, ?)',
    args: [id, req.file.buffer.toString('base64'), mime, Date.now()],
  });
  res.json({ url: '/api/img/' + id });
}));

// Serve an uploaded image from the database.
app.get('/api/img/:id', ah(async (req, res) => {
  const id = String(req.params.id || '').slice(0, 128);
  const row = (await db.execute({ sql: 'SELECT data, mime FROM images WHERE id = ?', args: [id] })).rows[0];
  if (!row || !row.data) return res.status(404).end();
  res.set('Content-Type', row.mime || 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(row.data, 'base64'));
}));

// AI fabric-name suggestion (Google Gemini). Never logs or exposes the API key.
app.post('/api/admin/suggest-name', requireAdmin, ah(async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(503).json({ error: 'AI name suggestion is not set up yet. Add GEMINI_API_KEY in Render → Environment.' });
    }
    const { image_url, image_preview } = req.body || {};
    let buf;
    let mime = 'image/jpeg';
    let ext = '.jpg';
    if (image_preview && typeof image_preview === 'string' && image_preview.length > 100) {
      // Client sent a small preview (original file untouched on disk)
      try { buf = Buffer.from(image_preview, 'base64'); }
      catch (e) { return res.status(400).json({ error: 'Invalid preview data.' }); }
    } else if (image_url && typeof image_url === 'string' && image_url.startsWith('/api/img/')) {
      // Image stored in the database
      const imgId = image_url.slice('/api/img/'.length).split(/[/?#]/)[0].slice(0, 128);
      const imgRow = (await db.execute({ sql: 'SELECT data, mime FROM images WHERE id = ?', args: [imgId] })).rows[0];
      if (!imgRow || !imgRow.data) return res.status(404).json({ error: 'Image not found. Please upload again.' });
      buf = Buffer.from(imgRow.data, 'base64');
      mime = imgRow.mime || 'image/jpeg';
      ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
    } else if (image_url && typeof image_url === 'string' && image_url.startsWith('/images/uploads/')) {
      // Legacy disk uploads (local dev only — Render's disk is ephemeral)
      const resolved = path.resolve(path.join(__dirname, 'public', image_url));
      const uploadsRoot = path.resolve(uploadDir);
      if (!resolved.startsWith(uploadsRoot + path.sep)) {
        return res.status(400).json({ error: 'Invalid image path.' });
      }
      try { buf = fs.readFileSync(resolved); }
      catch (e) { return res.status(404).json({ error: 'Image file not found. Please upload again.' }); }
      ext = path.extname(resolved).toLowerCase();
      mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    } else {
      return res.status(400).json({ error: 'Upload a fabric photo first.' });
    }
    if (buf.length > 12 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image is too large for AI analysis.' });
    }
    const prompt = "This is a fabric print photo for a women's clothing brand. Suggest a short, elegant fabric name in the format '[Color] [Color] [Pattern] Print' (e.g., 'Magenta Golden Floral Print'). Return ONLY the name, nothing else.";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    let apiRes;
    // First, discover available models
    let modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    try {
      const listRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(GEMINI_API_KEY),
        { signal: controller.signal }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = (listData.models || [])
          .map(m => (m.name || '').replace('models/', ''))
          .filter(n => n && /flash/i.test(n));
        if (available.length) modelsToTry = available.slice(0, 3);
        console.error('Available flash models:', modelsToTry.join(', '));
      }
    } catch (e) { console.error('Model list failed, using defaults'); }
    let lastStatus = 0;
    try {
      for (const model of modelsToTry) {
        apiRes = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(GEMINI_API_KEY),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: buf.toString('base64') } }] }],
            generationConfig: { maxOutputTokens: 40, temperature: 0.4 },
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
            ],
          }),
          signal: controller.signal,
          }
        );
        lastStatus = apiRes.status;
        if (apiRes.ok) break;
      }
    } finally {
      clearTimeout(timer);
    }
    if (!apiRes.ok) {
      let errBody = '';
      try { errBody = await apiRes.text(); } catch (e) {}
      console.error('Gemini API error, status:', apiRes.status, 'body:', errBody.slice(0, 500));
      return res.status(502).json({ error: 'AI service error (code ' + apiRes.status + '). Please check API key and try again.' });
    }
    const data = await apiRes.json();
    console.error('Gemini response:', JSON.stringify(data).slice(0, 1000));
    let text = '';
    try {
      const cands = data.candidates || [];
      for (const c of cands) {
        const parts = (c.content && c.content.parts) || [];
        for (const p of parts) { if (p.text) text += p.text; }
      }
      text = text.trim();
      // Check for blocked content
      if (!text && cands[0] && cands[0].finishReason) {
        console.error('Finish reason:', cands[0].finishReason);
      }
    } catch (e) { console.error('Parse error:', e.message); text = ''; }
    if (!text) return res.status(502).json({ error: 'AI returned no name. Please try again.' });
    const name = text.split('\n')[0].trim().replace(/^["'“”]+|["'“”]+$/g, '').slice(0, 80);
    res.json({ name });
  } catch (e) {
    console.error('suggest-name failed:', e && e.message ? e.message : e);
    res.status(500).json({ error: 'Could not suggest a name. Please try again.' });
  }
}));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Stock management page (owner-only; the page itself gates on the admin token)
app.get('/stock', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stock.html'));
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// JSON error handler (must be last — catches async errors and multer errors)
app.use((err, req, res, next) => {
  console.error('Request error:', err && err.message ? err.message : err);
  if (res.headersSent) return next(err);
  res.status(err.status || 400).json({ error: err.message || 'Request failed' });
});

// Start only after the database (schema + seed + migration) is ready
initDb()
  .then(() => app.listen(PORT, () => console.log(`ASAL by Aash listening on port ${PORT}`)))
  .catch((e) => { console.error('Database init failed:', e); process.exit(1); });
