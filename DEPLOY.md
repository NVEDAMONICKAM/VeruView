# Deploying VeruView to Vercel

## Architecture on Vercel

```
GitHub repo
    │
    └── Vercel project
          ├── Frontend  → client/dist      (static, served at /)
          └── Backend   → api/index.js     (serverless function at /api/*)
                              └── uses server/src/app.js (Express)
```

All `/api/*` requests are routed to the Express serverless function.
All other routes serve the built React SPA (`client/dist/index.html`).

---

## Step-by-step deployment

### 1. Push the repo to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create veruview --public --push
```

### 2. Import into Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. Vercel auto-detects the `vercel.json` — no framework preset needed

### 3. Add environment variables

In the Vercel dashboard → **Settings → Environment Variables**, add:

| Variable               | Value                                                    |
|------------------------|----------------------------------------------------------|
| `SESSION_SECRET`       | A long random string (e.g. output of `openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID`     | From Google Cloud Console (optional)                     |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console (optional)                     |
| `GOOGLE_CALLBACK_URL`  | `https://your-app.vercel.app/api/auth/google/callback`   |
| `CLIENT_URL`           | `https://your-app.vercel.app`                            |

> `DATABASE_URL` will be added automatically in step 4.

### 4. Enable Vercel Postgres

1. In Vercel dashboard → **Storage** tab → **Create Database** → **Postgres**
2. Choose a region close to your users
3. Click **Connect to Project** — Vercel automatically adds `DATABASE_URL`,
   `POSTGRES_URL`, and related variables to your project environment

### 5. Deploy

Vercel auto-deploys on every push to `main`. To trigger manually:

```bash
npx vercel --prod
```

### 6. Initialise the database schema

After the first successful deploy, run from your local machine:

```bash
# Pull production env vars to your local machine
npx vercel env pull server/.env.production

# Apply migrations to the production database
cd server
DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d= -f2-) \
  npx prisma migrate deploy

# Optionally seed demo data
DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d= -f2-) \
  node prisma/seed.js
```

Or open **Vercel Postgres** in the dashboard and run the migration SQL directly.

### 7. Google OAuth setup

In [Google Cloud Console](https://console.cloud.google.com):

1. Go to **APIs & Services → Credentials**
2. Edit your OAuth 2.0 Client ID
3. Under **Authorised redirect URIs**, add:
   ```
   https://your-app.vercel.app/api/auth/google/callback
   ```
4. Save — changes take ~5 minutes to propagate

---

## Known limitations (MVP)

| Limitation | Notes |
|---|---|
| **Photo uploads** | Multer writes to the local filesystem, which is ephemeral on Vercel. Photos uploaded in production will disappear after a function cold start. **Fix:** replace Multer with [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) or AWS S3 in `server/src/routes/people.js`. |
| **Session persistence** | Sessions are stored in Postgres (`connect-pg-simple`) — this works correctly on Vercel serverless. |
| **Serverless cold starts** | First request after inactivity may take 1–2s. This is normal for serverless. |

---

## Local development (unchanged)

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)
