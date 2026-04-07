/**
 * api/index.js — Vercel Serverless Function entry point.
 *
 * Vercel routes all /api/* requests here (see vercel.json).
 * The Express app handles routing internally.
 *
 * NOTE: File uploads (Multer) write to the local filesystem which is
 * ephemeral in serverless environments. For production, replace Multer
 * with Vercel Blob (https://vercel.com/docs/storage/vercel-blob) or
 * AWS S3 and update server/src/routes/people.js accordingly.
 */
const app = require('../server/src/app');

module.exports = app;
