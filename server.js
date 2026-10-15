const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'asal2026';

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

// --- Middleware ---
app.use(express.json({ limit: '2mb' }));
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
function rowToJson(r) {
  return {
    id: r.id,
    fabric_name: r.fabric_name,
    fabric_image_url: r.fabric_image_key,
    model_names: [r.model_1_name, r.model_2_name, r.model_3_name, r.model_4_name],
    model_image_urls: [r.model_1_image_key, r.model_2_image_key, r.model_3_image_key, r.model_4_image_key],
    model_prices: [r.model_1_price || '', r.model_2_price || '', r.model_3_price || '', r.model_4_price || ''],
  };
}

app.get('/api/catalog', (req, res) => {
  const rows = db.prepare('SELECT * FROM fabric_rows ORDER BY id ASC').all();
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

app.get('/api/admin/catalog', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM fabric_rows ORDER BY id ASC').all();
  res.json({ rows: rows.map(rowToJson) });
});

app.post('/api/admin/catalog', requireAdmin, (req, res) => {
  const { fabric_name, fabric_image_url, model_names, model_image_urls, model_prices } = req.body || {};
  if (!fabric_name) return res.status(400).json({ error: 'fabric_name required' });
  const names = model_names || MODEL_NAMES;
  const imgs = model_image_urls || ['', '', '', ''];
  const prices = model_prices || ['', '', '', ''];
  const info = db.prepare(`INSERT INTO fabric_rows
    (fabric_name, fabric_image_key, model_1_name, model_1_image_key, model_1_price,
     model_2_name, model_2_image_key, model_2_price, model_3_name, model_3_image_key, model_3_price,
     model_4_name, model_4_image_key, model_4_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(fabric_name, fabric_image_url || '',
      names[0] || MODEL_NAMES[0], imgs[0] || '', prices[0] || '',
      names[1] || MODEL_NAMES[1], imgs[1] || '', prices[1] || '',
      names[2] || MODEL_NAMES[2], imgs[2] || '', prices[2] || '',
      names[3] || MODEL_NAMES[3], imgs[3] || '', prices[3] || '');
  const row = db.prepare('SELECT * FROM fabric_rows WHERE id = ?').get(info.lastInsertRowid);
  res.json({ row: rowToJson(row) });
});

app.put('/api/admin/catalog/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { fabric_name, fabric_image_url, model_names, model_image_urls, model_prices } = req.body || {};
  const existing = db.prepare('SELECT * FROM fabric_rows WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const names = model_names || [existing.model_1_name, existing.model_2_name, existing.model_3_name, existing.model_4_name];
  const imgs = model_image_urls || [existing.model_1_image_key, existing.model_2_image_key, existing.model_3_image_key, existing.model_4_image_key];
  const prices = model_prices || [existing.model_1_price, existing.model_2_price, existing.model_3_price, existing.model_4_price];
  db.prepare(`UPDATE fabric_rows SET fabric_name=?, fabric_image_key=?,
    model_1_name=?, model_1_image_key=?, model_1_price=?,
    model_2_name=?, model_2_image_key=?, model_2_price=?,
    model_3_name=?, model_3_image_key=?, model_3_price=?,
    model_4_name=?, model_4_image_key=?, model_4_price=? WHERE id=?`)
    .run(fabric_name ?? existing.fabric_name, fabric_image_url ?? existing.fabric_image_key,
      names[0], imgs[0], prices[0], names[1], imgs[1], prices[1],
      names[2], imgs[2], prices[2], names[3], imgs[3], prices[3], id);
  const row = db.prepare('SELECT * FROM fabric_rows WHERE id = ?').get(id);
  res.json({ row: rowToJson(row) });
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

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`ASAL by Aash listening on port ${PORT}`));
