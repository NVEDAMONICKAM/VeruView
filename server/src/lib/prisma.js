const { PrismaClient } = require('@prisma/client');

// Singleton pattern — prevents "too many connections" in serverless/hot-reload environments.
// Explicitly passes DATABASE_URL so the client works even when env vars are loaded
// after module evaluation (e.g. Vercel serverless cold starts with dotenv).
const globalForPrisma = global;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
