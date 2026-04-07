/**
 * seed.js — Creates a sample Tamil family tree for VeruView demo purposes.
 *
 * Run with: npm run db:seed (from the /server directory)
 *
 * Family structure:
 *
 *   Raman (Grandfather) ──── Meenakshi (Grandmother)   [Paternal]
 *         │                         │
 *         ├── Gopal (Raman's older brother)
 *         │
 *   Murugan (Father) ────────── Kavitha (Mother)
 *         │                         │
 *         ├── Arjun (Son, born 1990)
 *         └── Priya (Daughter, born 1993)
 *
 *   Selvam (Grandfather) ──── Lakshmi (Grandmother)    [Maternal]
 *         │
 *         └── Kavitha (Mother, born 1965)
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding VeruView demo data...');

  // ── Demo user ─────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('demo1234', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@veruview.app' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@veruview.app',
      passwordHash,
    },
  });
  console.log(`  ✓ User: ${user.email}`);

  // ── Delete existing demo tree if re-running ────────────────────────────────
  await prisma.familyTree.deleteMany({
    where: { ownerId: user.id, name: 'Murugan Family Tree' },
  });

  // ── Create the Tamil family tree ───────────────────────────────────────────
  const tree = await prisma.familyTree.create({
    data: {
      name: 'Murugan Family Tree',
      ownerId: user.id,
      culture: 'TAMIL',
    },
  });
  console.log(`  ✓ Tree: ${tree.name} (TAMIL)`);

  // ── Create people ──────────────────────────────────────────────────────────
  const people = await Promise.all([
    prisma.person.create({
      data: { treeId: tree.id, name: 'Murugan',   dob: new Date('1962-03-15'), gender: 'MALE' },
    }),
    prisma.person.create({
      data: { treeId: tree.id, name: 'Kavitha',   dob: new Date('1965-07-22'), gender: 'FEMALE' },
    }),
    prisma.person.create({
      data: { treeId: tree.id, name: 'Arjun',     dob: new Date('1990-11-08'), gender: 'MALE' },
    }),
    prisma.person.create({
      data: { treeId: tree.id, name: 'Priya',     dob: new Date('1993-04-14'), gender: 'FEMALE' },
    }),
    prisma.person.create({
      data: { treeId: tree.id, name: 'Raman',     dob: new Date('1935-01-20'), gender: 'MALE' },
    }),
    prisma.person.create({
      data: { treeId: tree.id, name: 'Meenakshi', dob: new Date('1938-09-05'), gender: 'FEMALE' },
    }),
    prisma.person.create({
      data: { treeId: tree.id, name: 'Selvam',    dob: new Date('1937-06-12'), gender: 'MALE' },
    }),
    prisma.person.create({
      data: { treeId: tree.id, name: 'Lakshmi',   dob: new Date('1940-11-30'), gender: 'FEMALE' },
    }),
    prisma.person.create({
      data: { treeId: tree.id, name: 'Gopal',     dob: new Date('1930-03-01'), gender: 'MALE' },
    }),
  ]);

  const [murugan, kavitha, arjun, priya, raman, meenakshi, selvam, lakshmi, gopal] = people;
  console.log(`  ✓ Created ${people.length} people`);

  // ── Create relationships ───────────────────────────────────────────────────
  // Convention: PARENT means fromPerson IS A PARENT OF toPerson
  const relationships = [
    // Murugan & Kavitha are spouses
    { fromPersonId: murugan.id, toPersonId: kavitha.id, type: 'SPOUSE' },

    // Murugan & Kavitha are parents of Arjun & Priya
    { fromPersonId: murugan.id,  toPersonId: arjun.id,  type: 'PARENT' },
    { fromPersonId: kavitha.id,  toPersonId: arjun.id,  type: 'PARENT' },
    { fromPersonId: murugan.id,  toPersonId: priya.id,  type: 'PARENT' },
    { fromPersonId: kavitha.id,  toPersonId: priya.id,  type: 'PARENT' },

    // Arjun & Priya are siblings
    { fromPersonId: arjun.id, toPersonId: priya.id, type: 'SIBLING' },

    // Raman & Meenakshi are Murugan's parents (paternal grandparents of Arjun/Priya)
    { fromPersonId: raman.id,     toPersonId: murugan.id, type: 'PARENT' },
    { fromPersonId: meenakshi.id, toPersonId: murugan.id, type: 'PARENT' },

    // Raman & Meenakshi are spouses
    { fromPersonId: raman.id, toPersonId: meenakshi.id, type: 'SPOUSE' },

    // Selvam & Lakshmi are Kavitha's parents (maternal grandparents of Arjun/Priya)
    { fromPersonId: selvam.id,  toPersonId: kavitha.id, type: 'PARENT' },
    { fromPersonId: lakshmi.id, toPersonId: kavitha.id, type: 'PARENT' },

    // Selvam & Lakshmi are spouses
    { fromPersonId: selvam.id, toPersonId: lakshmi.id, type: 'SPOUSE' },

    // Gopal is Raman's older brother (Periyappā from Murugan's perspective)
    { fromPersonId: gopal.id, toPersonId: raman.id, type: 'SIBLING' },
  ];

  for (const rel of relationships) {
    await prisma.relationship.create({ data: { treeId: tree.id, ...rel } });
  }
  console.log(`  ✓ Created ${relationships.length} relationships`);

  // ── Create share link ──────────────────────────────────────────────────────
  const shareToken = 'demo-murugan-family';
  await prisma.treeShare.upsert({
    where: { shareToken },
    update: {},
    create: { treeId: tree.id, shareToken },
  });
  console.log(`  ✓ Share link: /share/${shareToken}`);

  console.log('\n✅ Seed complete!');
  console.log('   Login: demo@veruview.app / demo1234');
  console.log(`   Tree perspective: Try clicking on "Arjun" to see all Tamil titles from his perspective.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
