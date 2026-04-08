/**
 * remove_sibling_edges.js
 *
 * One-time migration: removes all SIBLING relationship edges from the database.
 * Sibling relationships are now derived implicitly from shared parent edges,
 * so explicit SIBLING edges are redundant.
 *
 * Run from the server/ directory:
 *   node prisma/migrations/remove_sibling_edges.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getParentIds(personId) {
  const [asToChild, asFromChild] = await Promise.all([
    // PARENT edges where this person is the child (toPersonId)
    prisma.relationship.findMany({
      where: { toPersonId: personId, type: 'PARENT' },
      select: { fromPersonId: true },
    }),
    // CHILD edges where this person is the child (fromPersonId)
    prisma.relationship.findMany({
      where: { fromPersonId: personId, type: 'CHILD' },
      select: { toPersonId: true },
    }),
  ]);
  return new Set([
    ...asToChild.map((r) => r.fromPersonId),
    ...asFromChild.map((r) => r.toPersonId),
  ]);
}

async function main() {
  const siblings = await prisma.relationship.findMany({
    where: { type: 'SIBLING' },
  });

  console.log(`Found ${siblings.length} SIBLING relationship(s) to remove.`);
  if (siblings.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let redundant = 0;
  let noSharedParent = 0;

  for (const rel of siblings) {
    const [fromParents, toParents] = await Promise.all([
      getParentIds(rel.fromPersonId),
      getParentIds(rel.toPersonId),
    ]);

    const hasSharedParent = [...fromParents].some((pid) => toParents.has(pid));

    if (hasSharedParent) {
      console.log(`  [redundant]      ${rel.id} — shared parent found, sibling is derivable`);
      redundant++;
    } else {
      console.log(`  [no shared parent] ${rel.id} — no common parent edge exists (relationship will be lost)`);
      noSharedParent++;
    }

    await prisma.relationship.delete({ where: { id: rel.id } });
  }

  console.log(`\nDone. Deleted ${siblings.length} SIBLING edge(s).`);
  console.log(`  Redundant (derivable from parents): ${redundant}`);
  console.log(`  Without shared parent (data gap):   ${noSharedParent}`);
  if (noSharedParent > 0) {
    console.log('\n  ⚠  For the data-gap cases, consider adding PARENT edges so the');
    console.log('     sibling relationship can be re-derived from shared parents.');
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
