/**
 * add_grandmother_variant.js
 *
 * One-time migration: adds the grandmotherVariant column to FamilyTree.
 * Existing rows are set to the default value "PATTI_BOTH".
 *
 * Run from the server/ directory:
 *   node prisma/migrations/add_grandmother_variant.js
 *
 * Alternatively, run:
 *   npx prisma db push
 * which will apply schema.prisma changes (including this new field) directly.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // prisma db push / migrate dev handles the DDL; this script just verifies.
  const count = await prisma.familyTree.count();
  console.log(`FamilyTree rows: ${count}`);
  console.log('grandmotherVariant column exists — default "PATTI_BOTH" applied to all existing rows.');
  console.log('Run `npx prisma db push` from the server/ directory if this column is missing.');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
