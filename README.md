# VeruView — Your roots. Your culture.

**VeruView** (from வேர், Tamil for "roots") is a culturally-aware family tree builder. It lets you map family relationships and view kinship titles in your own cultural language — starting with English and Tamil, designed to expand to Hindi, Telugu, Malayalam, and more.

---

## Features

- **Interactive family tree canvas** — drag, zoom, and pan powered by React Flow
- **Cultural kinship titles** — Tamil (திருவாட்டு பெயர்கள்) and English, with accurate role names (அப்பா, அம்மா, அண்ணன்…)
- **Perspective switching** — click any person to view all titles from their point of view
- **Multiple trees** — create and manage many family trees per account
- **Share links** — one-click read-only share URL
- **Photo uploads** — profile photos for each person
- **Google OAuth** + email/password auth
- **Title overrides** — customize any kinship label per tree

---

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | React 18 + Vite, TailwindCSS, React Flow, Dagre |
| Backend    | Node.js + Express |
| Database   | PostgreSQL + Prisma ORM |
| Auth       | Passport.js (local + Google OAuth2), express-session |
| File store | Multer (local disk, `/server/uploads/`) |

---

## Project Structure

```
VeruView/
├── client/                 ← React + Vite frontend
│   ├── src/
│   │   ├── api/            ← Axios API client
│   │   ├── components/     ← Logo, PersonNode, TopBar, modals…
│   │   ├── context/        ← AuthContext
│   │   └── pages/          ← Login, Register, Dashboard, TreeView, SharedTreeView
│   └── public/
└── server/                 ← Express backend
    ├── prisma/
    │   ├── schema.prisma   ← Database schema
    │   └── seed.js         ← Demo Tamil family tree
    └── src/
        ├── lib/
        │   ├── kinship.js  ← ★ Cultural kinship title calculator
        │   └── prisma.js
        ├── middleware/
        └── routes/
```

---

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (running locally or via Docker)

### 1. Clone & install

```bash
git clone <repo-url>
cd VeruView

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure environment

```bash
cd server
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/veruview"
SESSION_SECRET="a-long-random-string-change-me"

# Optional — only needed for Google login
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"

CLIENT_URL="http://localhost:5173"
PORT=3001
```

### 3. Create the database

```bash
# From the server/ directory
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Seed demo data

```bash
npm run db:seed
```

This creates:
- A demo user: `demo@veruview.app` / `demo1234`
- A Tamil family tree (Murugan Family Tree) with 9 members and accurate kinship relationships

### 5. Run the app

Open two terminals:

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

---

## Adding a New Culture

The kinship engine (`server/src/lib/kinship.js`) is intentionally culture-agnostic. Adding a new culture (e.g. Hindi) requires two steps:

1. **Add a title map** in `kinship.js` under `CULTURE_TITLES`:

```js
const HINDI_TITLES = {
  father:         { script: 'पिताजी', transliteration: 'Pitāji', english: 'Father' },
  mother:         { script: 'माँ',    transliteration: 'Māṃ',    english: 'Mother' },
  // ... (use the same keys as TAMIL_TITLES)
};

const CULTURE_TITLES = {
  TAMIL: TAMIL_TITLES,
  ENGLISH: ENGLISH_TITLES,
  HINDI: HINDI_TITLES,   // ← add here
};
```

2. **Add the enum value** to `schema.prisma`:

```prisma
enum Culture {
  ENGLISH
  TAMIL
  HINDI   // ← add here
}
```

Then run `npx prisma migrate dev`. The frontend culture toggle will automatically pick it up once you update the UI.

---

## API Reference

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/auth/google
GET    /api/auth/google/callback

GET    /api/trees
POST   /api/trees
GET    /api/trees/:id
PUT    /api/trees/:id
DELETE /api/trees/:id
POST   /api/trees/:id/share
GET    /api/trees/:id/kinship/:perspectiveId
PUT    /api/trees/:id/title-overrides

GET    /api/trees/:treeId/people
POST   /api/trees/:treeId/people          (multipart/form-data)
PUT    /api/trees/:treeId/people/:id      (multipart/form-data)
DELETE /api/trees/:treeId/people/:id

GET    /api/trees/:treeId/relationships
POST   /api/trees/:treeId/relationships
PUT    /api/trees/:treeId/relationships/:id
DELETE /api/trees/:treeId/relationships/:id

GET    /api/share/:token
GET    /api/share/:token/kinship/:perspectiveId
```

---

## Demo

After seeding, log in as `demo@veruview.app` and open **Murugan Family Tree**. Click on different people to switch perspective and watch the Tamil kinship titles update across the whole tree. Try toggling Tamil ↔ English with the culture button in the top bar.

---

## License

MIT
