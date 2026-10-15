# ASAL by Aash — Render Deployment

Standalone Node.js + Express + SQLite web app for the ASAL by Aash website.

## Quick Start (Render)

1. Push this folder to a GitHub repo
2. In Render dashboard: **New → Web Service** → select the repo
3. Settings:
   - **Name:** `asalbyaash` (gives `asalbyaash.onrender.com`)
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Add environment variable:
   - `OWNER_PASSWORD` = your chosen owner password (default: `asal2026`)
5. Click **Deploy**

Or use `render.yaml` (Infrastructure as Code) — Render will pick it up automatically.

## Local Development

```bash
npm install
node server.js
# Open http://localhost:3000
```

## Features

- **Customer mode** (default): Browse catalog, tap photos for zoom lightbox (pinch zoom), order via WhatsApp, rate the website (1-5 stars, one per device)
- **Owner mode**: Visit `?owner=1` or click the discreet "Owner" footer link → login with password → edit all site text inline, manage catalog (add/edit/delete rows, upload photos, set prices)

## API

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/catalog` | GET | No | Fabric rows |
| `/api/content` | GET | No | Site text key-values |
| `/api/rating` | GET | No | {average, count} |
| `/api/rating` | POST | No | {stars, deviceId} |
| `/api/admin/login` | POST | No | {password} → {token} |
| `/api/admin/catalog` | GET | Yes | All rows |
| `/api/admin/catalog` | POST | Yes | Add row |
| `/api/admin/catalog/:id` | PUT | Yes | Update row |
| `/api/admin/catalog/:id` | DELETE | Yes | Delete row |
| `/api/admin/content` | PUT | Yes | {content: {key: value}} |
| `/api/admin/upload` | POST | Yes | Multipart image → {url} |

## Notes

- Database: SQLite file `asal.db` (auto-created and seeded on first run)
- Uploads go to `public/images/uploads/`
- On Render free plan, the SQLite file persists on disk but may be lost on redeploy — for production, consider Render's free PostgreSQL
- Light mode forced, English only
- WhatsApp: https://wa.me/c/919445991519
- Instagram: https://instagram.com/asal_byaash
