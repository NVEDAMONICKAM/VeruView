/**
 * app.js — Express application factory.
 * Exports the configured Express app WITHOUT calling app.listen().
 * This allows the same app to be used for:
 *   - Local dev:  server/src/index.js  (calls listen)
 *   - Vercel:     api/index.js          (exports as serverless handler)
 */
require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const passport   = require('passport');
const cors       = require('cors');
const path       = require('path');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
const prismaForSession = require('./lib/prisma');

const authRoutes         = require('./routes/auth');
const treeRoutes         = require('./routes/trees');
const peopleRoutes       = require('./routes/people');
const relationshipRoutes = require('./routes/relationships');
const shareRoutes        = require('./routes/shares');

const app = express();

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Session store (PostgreSQL)
// ---------------------------------------------------------------------------
app.use(
  session({
    store: new PrismaSessionStore(prismaForSession, {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      // On Vercel (HTTPS), enable secure cookies
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  })
);

// ---------------------------------------------------------------------------
// Passport
// ---------------------------------------------------------------------------
app.use(passport.initialize());
app.use(passport.session());

// Auth routes (also registers passport strategies)
app.use('/api/auth', authRoutes);

// ---------------------------------------------------------------------------
// Static uploads (local dev only — use cloud storage in production)
// ---------------------------------------------------------------------------
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/trees', treeRoutes);
app.use('/api/trees/:treeId/people', peopleRoutes);
app.use('/api/trees/:treeId/relationships', relationshipRoutes);
app.use('/api/share', shareRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

module.exports = app;
