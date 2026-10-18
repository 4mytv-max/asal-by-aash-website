const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const multer = require('multer');
const path = require('path');

const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'asal2026';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// --- Database ---
const dbPath = path.join(__dirname, 'asal.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');

// Schema (matches original artifact)
db.exec(`
  CREATE TABLE IF NOT EXISTS fabric_rows (
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
  );
  CREATE TABLE IF NOT EXISTS site_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    stars INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    UNIQUE(device_id)
  );
  CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_hash TEXT,
    user_agent TEXT,
    visited_at INTEGER NOT NULL,
    path TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_visits_at ON visits (visited_at);
`);

// --- Seed data ---
const SITE_CONTENT_SEED = {
  welcome_message: '✨ Welcome to ASAL by Aash — Custom-stitched comfort wear, made for you ✨',
  trust_strip_text: '✨ FABRIC IN STOCK ✨ Despatch in 7 Days ✨ Pan India Delivery ✨ 100% Pure Cotton ✨ Custom Stitching ✨ One Piece Per Fabric — No More Copies ✨ Unique ✨',
  hero_eyebrow: 'Our fabric, your design',
  hero_headline: 'Your Fabric or Ours.\nYour Design or Ours.',
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
  cta_strip_text: '✨ Ready for custom comfort? ✨ Order on WhatsApp ✨ Your Fabric or Ours ✨',
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

function seedIfEmpty() {
  const contentCount = db.prepare('SELECT COUNT(*) AS c FROM site_content').get().c;
  if (contentCount === 0) {
    const ins = db.prepare('INSERT INTO site_content (key, value) VALUES (?, ?)');
    db.exec('BEGIN');
    try {
      for (const [k, v] of Object.entries(SITE_CONTENT_SEED)) ins.run(k, v);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    console.log('Seeded site_content');
  }
  const rowCount = db.prepare('SELECT COUNT(*) AS c FROM fabric_rows').get().c;
  if (rowCount === 0) {
    const ins = db.prepare(`INSERT INTO fabric_rows
      (fabric_name, fabric_image_key, model_1_name, model_1_image_key, model_2_name, model_2_image_key,
       model_3_name, model_3_image_key, model_4_name, model_4_image_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    db.exec('BEGIN');
    try {
      for (const r of CATALOG_SEED) {
        const ext = r.ext || 'jpg';
        ins.run(
          r.fabric,
          `/images/catalog/${r.slug}-fabric.${ext}`,
          MODEL_NAMES[0], `/images/catalog/${r.slug}-${MODEL_SLUGS[0]}.${ext}`,
          MODEL_NAMES[1], `/images/catalog/${r.slug}-${MODEL_SLUGS[1]}.${ext}`,
          MODEL_NAMES[2], `/images/catalog/${r.slug}-${MODEL_SLUGS[2]}.${ext}`,
          MODEL_NAMES[3], `/images/catalog/${r.slug}-${MODEL_SLUGS[3]}.${ext}`
        );
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    console.log('Seeded fabric_rows');
  }
}
seedIfEmpty();

// --- Migration: unlimited model photos + row ordering ---
// One-time backfill, keyed on models_json IS NULL (idempotent across restarts).
// Rows that already have models_json are never touched again, so a user-defined
// sort_order is never clobbered by a later restart.
{
  const cols = db.prepare('PRAGMA table_info(fabric_rows)').all().map(c => c.name);
  if (!cols.includes('sort_order')) db.exec('ALTER TABLE fabric_rows ADD COLUMN sort_order INTEGER DEFAULT 0');
  if (!cols.includes('models_json')) db.exec('ALTER TABLE fabric_rows ADD COLUMN models_json TEXT');
  const legacyRows = db.prepare('SELECT * FROM fabric_rows WHERE models_json IS NULL').all();
  if (legacyRows.length) {
    const up = db.prepare('UPDATE fabric_rows SET sort_order = ?, models_json = ? WHERE id = ?');
    db.exec('BEGIN');
    try {
      for (const r of legacyRows) {
        const models = [];
        for (let i = 1; i <= 4; i++) {
          const name = r[`model_${i}_name`];
          if (name) models.push({ name, image_key: r[`model_${i}_image_key`] || '', price: r[`model_${i}_price`] || '' });
        }
        up.run(r.id, JSON.stringify(models), r.id); // sort_order = id preserves original id order
      }
      db.exec('COMMIT');
      console.log(`Migrated ${legacyRows.length} fabric row(s) to models_json + sort_order`);
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
}

// --- Middleware ---
app.set('trust proxy', 1); // Render sits behind a proxy — req.ip gives the real client IP
app.use(express.json({ limit: '2mb' }));

// Visitor analytics: log page views of the homepage only (no API, no static assets).
// Privacy: stores only a SHA256 hash (first 16 chars) of the IP, never the raw IP. No cookies.
const logVisit = db.prepare('INSERT INTO visits (ip_hash, user_agent, visited_at, path) VALUES (?, ?, ?, ?)');
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path === '/') {
    try {
      const ip = req.ip || '';
      const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
      const ua = (req.get('user-agent') || '').slice(0, 256);
      logVisit.run(ipHash, ua, Date.now(), req.path);
    } catch (e) { /* analytics must never break the page */ }
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

// Uploads
const uploadDir = path.join(__dirname, 'public', 'images', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

// --- Admin auth (simple token) ---
const adminTokens = new Set();
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token && adminTokens.has(token)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

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
    id: r.id,
    fabric_name: r.fabric_name,
    fabric_image_url: r.fabric_image_key,
    model_names: models.map(m => m.name),
    model_image_urls: models.map(m => m.image_key || ''),
    model_prices: models.map(m => m.price || ''),
  };
}

app.get('/api/catalog', (req, res) => {
  const rows = db.prepare('SELECT * FROM fabric_rows ORDER BY sort_order ASC, id ASC').all();
  res.json({ rows: rows.map(rowToJson) });
});

app.get('/api/content', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_content').all();
  const content = {};
  for (const r of rows) content[r.key] = r.value;
  res.json({ content });
});

app.get('/api/rating', (req, res) => {
  const agg = db.prepare('SELECT COUNT(*) AS count, AVG(stars) AS avg FROM site_ratings').get();
  res.json({
    average: agg.count ? Math.round(agg.avg * 10) / 10 : 0,
    count: agg.count,
  });
});

app.post('/api/rating', (req, res) => {
  const { stars, deviceId } = req.body || {};
  if (!Number.isInteger(stars) || stars < 1 || stars > 5)
    return res.status(400).json({ error: 'Stars must be 1-5' });
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 128)
    return res.status(400).json({ error: 'deviceId required' });
  try {
    db.prepare('INSERT INTO site_ratings (device_id, stars) VALUES (?, ?)').run(deviceId, stars);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE constraint failed'))
      return res.status(409).json({ error: 'Already rated on this device' });
    throw e;
  }
  const agg = db.prepare('SELECT COUNT(*) AS count, AVG(stars) AS avg FROM site_ratings').get();
  res.json({ average: Math.round(agg.avg * 10) / 10, count: agg.count });
});

// --- Admin API ---
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password === OWNER_PASSWORD) {
    const token = crypto.randomBytes(24).toString('hex');
    adminTokens.add(token);
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

// Visitor stats (IST day boundaries — the business is India-based)
const IST_OFFSET_MS = 5.5 * 3600 * 1000;
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const now = Date.now();
  const istMidnightUtc = Math.floor((now + IST_OFFSET_MS) / 86400000) * 86400000 - IST_OFFSET_MS;
  const thirtyDaysAgo = now - 30 * 86400000;

  const total = db.prepare('SELECT COUNT(*) AS c FROM visits').get().c;
  const today = db.prepare('SELECT COUNT(*) AS c FROM visits WHERE visited_at >= ?').get(istMidnightUtc).c;
  const unique = db.prepare('SELECT COUNT(DISTINCT ip_hash) AS c FROM visits').get().c;
  const byDay = db.prepare(`
    SELECT date(visited_at / 1000, 'unixepoch', '+330 minutes') AS date, COUNT(*) AS count
    FROM visits WHERE visited_at >= ?
    GROUP BY date ORDER BY date ASC
  `).all(thirtyDaysAgo);

  res.json({
    total_visits: total,
    today_visits: today,
    unique_visitors: unique,
    visits_by_day: byDay,
  });
});

app.get('/api/admin/catalog', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM fabric_rows ORDER BY sort_order ASC, id ASC').all();
  res.json({ rows: rows.map(rowToJson) });
});

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

app.post('/api/admin/catalog', requireAdmin, (req, res) => {
  const { fabric_name, fabric_image_url, model_names, model_image_urls, model_prices } = req.body || {};
  if (!fabric_name) return res.status(400).json({ error: 'fabric_name required' });
  const models = buildModels(model_names, model_image_urls, model_prices);
  const m = (i) => models[i] || { name: MODEL_NAMES[i] || `Model ${i + 1}`, image_key: '', price: '' };
  const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS mx FROM fabric_rows').get().mx + 1;
  const info = db.prepare(`INSERT INTO fabric_rows
    (fabric_name, fabric_image_key, model_1_name, model_1_image_key, model_1_price,
     model_2_name, model_2_image_key, model_2_price, model_3_name, model_3_image_key, model_3_price,
     model_4_name, model_4_image_key, model_4_price, sort_order, models_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(fabric_name, fabric_image_url || '',
      m(0).name, m(0).image_key, m(0).price,
      m(1).name, m(1).image_key, m(1).price,
      m(2).name, m(2).image_key, m(2).price,
      m(3).name, m(3).image_key, m(3).price,
      nextOrder, JSON.stringify(models));
  const row = db.prepare('SELECT * FROM fabric_rows WHERE id = ?').get(info.lastInsertRowid);
  res.json({ row: rowToJson(row) });
});

app.put('/api/admin/catalog/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { fabric_name, fabric_image_url, model_names, model_image_urls, model_prices } = req.body || {};
  const existing = db.prepare('SELECT * FROM fabric_rows WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  // Fall back to the row's existing full models (never truncate to 4 on a partial edit).
  const cur = rowModels(existing);
  const names = Array.isArray(model_names) && model_names.length ? model_names : cur.map(m => m.name);
  const imgs = Array.isArray(model_image_urls) && model_image_urls.length ? model_image_urls : cur.map(m => m.image_key);
  const prices = Array.isArray(model_prices) && model_prices.length ? model_prices : cur.map(m => m.price);
  const models = buildModels(names, imgs, prices);
  const m = (i) => models[i] || { name: MODEL_NAMES[i] || `Model ${i + 1}`, image_key: '', price: '' };
  db.prepare(`UPDATE fabric_rows SET fabric_name=?, fabric_image_key=?,
    model_1_name=?, model_1_image_key=?, model_1_price=?,
    model_2_name=?, model_2_image_key=?, model_2_price=?,
    model_3_name=?, model_3_image_key=?, model_3_price=?,
    model_4_name=?, model_4_image_key=?, model_4_price=?,
    models_json=? WHERE id=?`)
    .run(fabric_name ?? existing.fabric_name, fabric_image_url ?? existing.fabric_image_key,
      m(0).name, m(0).image_key, m(0).price, m(1).name, m(1).image_key, m(1).price,
      m(2).name, m(2).image_key, m(2).price, m(3).name, m(3).image_key, m(3).price,
      JSON.stringify(models), id);
  const row = db.prepare('SELECT * FROM fabric_rows WHERE id = ?').get(id);
  res.json({ row: rowToJson(row) });
});

app.post('/api/admin/catalog/reorder', requireAdmin, (req, res) => {
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
  const existingIds = new Set(db.prepare('SELECT id FROM fabric_rows').all().map(r => r.id));
  const up = db.prepare('UPDATE fabric_rows SET sort_order = ? WHERE id = ?');
  db.exec('BEGIN');
  try {
    ids.forEach((id, idx) => { if (existingIds.has(id)) up.run(idx, id); });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  res.json({ ok: true });
});

app.delete('/api/admin/catalog/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM fabric_rows WHERE id = ?').run(Number(req.params.id));
  res.json({ deleted: info.changes });
});

app.put('/api/admin/content', requireAdmin, (req, res) => {
  const { content } = req.body || {};
  if (!content || typeof content !== 'object') return res.status(400).json({ error: 'content object required' });
  const up = db.prepare('INSERT INTO site_content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  db.exec('BEGIN');
  try {
    for (const [k, v] of Object.entries(content)) up.run(k, String(v ?? ''));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  res.json({ ok: true });
});

app.post('/api/admin/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  res.json({ url: '/images/uploads/' + req.file.filename });
});

// AI fabric-name suggestion (Google Gemini). Never logs or exposes the API key.
app.post('/api/admin/suggest-name', requireAdmin, async (req, res) => {
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
    } else if (image_url && typeof image_url === 'string' && image_url.startsWith('/images/uploads/')) {
      const resolved = path.resolve(path.join(__dirname, 'public', image_url));
      const uploadsRoot = path.resolve(uploadDir);
      if (!resolved.startsWith(uploadsRoot + path.sep)) {
        return res.status(400).json({ error: 'Invalid image path.' });
      }
      try { buf = fs.readFileSync(resolved); }
      catch (e) { return res.status(404).json({ error: 'Image file not found. Please upload again.' }); }
      ext = path.extname(resolved).toLowerCase();
    } else {
      return res.status(400).json({ error: 'Upload a fabric photo first.' });
    }
    if (buf.length > 12 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image is too large for AI analysis.' });
    }
    mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
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
});

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

app.listen(PORT, () => console.log(`ASAL by Aash listening on port ${PORT}`));
