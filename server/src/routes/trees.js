const express = require('express');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { computeKinship } = require('../lib/kinship');

const router = express.Router();

// GET /api/trees — list user's trees
router.get('/', requireAuth, async (req, res) => {
  try {
    const trees = await prisma.familyTree.findMany({
      where: { ownerId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(trees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trees — create a new tree
router.post('/', requireAuth, async (req, res) => {
  const { name, culture } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const tree = await prisma.familyTree.create({
      data: {
        name,
        ownerId: req.user.id,
        culture: culture || 'ENGLISH',
      },
    });
    res.status(201).json(tree);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trees/:id — get full tree (people, relationships, title overrides)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const tree = await prisma.familyTree.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
      include: {
        people: true,
        relationships: true,
        titleOverrides: true,
        shares: { select: { shareToken: true } },
      },
    });
    if (!tree) return res.status(404).json({ error: 'Tree not found' });
    res.json(tree);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/trees/:id — update name, culture, or grandmotherVariant
router.put('/:id', requireAuth, async (req, res) => {
  const { name, culture, grandmotherVariant } = req.body;
  const VALID_VARIANTS = ['PATTI_BOTH', 'PATTI_AMMACHI', 'AMMACHI_BOTH'];
  if (grandmotherVariant !== undefined && !VALID_VARIANTS.includes(grandmotherVariant)) {
    return res.status(400).json({ error: 'Invalid grandmotherVariant' });
  }
  try {
    const tree = await prisma.familyTree.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
    });
    if (!tree) return res.status(404).json({ error: 'Tree not found' });

    const updated = await prisma.familyTree.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(culture !== undefined && { culture }),
        ...(grandmotherVariant !== undefined && { grandmotherVariant }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/trees/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const tree = await prisma.familyTree.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
    });
    if (!tree) return res.status(404).json({ error: 'Tree not found' });

    await prisma.familyTree.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trees/duplicate — deep-copy a shared tree into the logged-in user's account
router.post('/duplicate', requireAuth, async (req, res) => {
  const { shareToken, newName } = req.body;
  if (!shareToken) return res.status(400).json({ error: 'shareToken is required' });

  try {
    const share = await prisma.treeShare.findUnique({
      where: { shareToken },
      include: {
        tree: {
          include: {
            people: true,
            relationships: true,
            titleOverrides: true,
          },
        },
      },
    });
    if (!share) return res.status(404).json({ error: 'Share link not found' });

    const src = share.tree;
    const treeName = newName?.trim() || `${src.name} (copy)`;

    // Build old→new ID maps
    const personIdMap = new Map();
    src.people.forEach((p) => personIdMap.set(p.id, uuidv4()));

    const newTree = await prisma.$transaction(async (tx) => {
      // 1. Create new tree
      const created = await tx.familyTree.create({
        data: {
          name: treeName,
          ownerId: req.user.id,
          culture: src.culture,
          grandmotherVariant: src.grandmotherVariant ?? 'PATTI_BOTH',
          nodePositionsJson: {},
        },
      });

      // 2. Copy people
      if (src.people.length > 0) {
        await tx.person.createMany({
          data: src.people.map((p) => ({
            id: personIdMap.get(p.id),
            treeId: created.id,
            name: p.name,
            gender: p.gender,
            dob: p.dob,
            photoUrl: p.photoUrl,
          })),
        });
      }

      // 3. Copy relationships (remap person IDs)
      if (src.relationships.length > 0) {
        const remapped = src.relationships
          .filter((r) => personIdMap.has(r.fromPersonId) && personIdMap.has(r.toPersonId))
          .map((r) => ({
            id: uuidv4(),
            treeId: created.id,
            fromPersonId: personIdMap.get(r.fromPersonId),
            toPersonId: personIdMap.get(r.toPersonId),
            type: r.type,
            isBiological: r.isBiological,
          }));
        if (remapped.length > 0) {
          await tx.relationship.createMany({ data: remapped });
        }
      }

      // 4. Copy title overrides
      if (src.titleOverrides.length > 0) {
        await tx.titleOverride.createMany({
          data: src.titleOverrides.map((ov) => ({
            id: uuidv4(),
            treeId: created.id,
            relationshipKey: ov.relationshipKey,
            culture: ov.culture,
            script: ov.script,
            transliteration: ov.transliteration,
            english: ov.english,
          })),
        });
      }

      return created;
    });

    res.status(201).json({ treeId: newTree.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trees/:id/share — create or return share token
router.post('/:id/share', requireAuth, async (req, res) => {
  try {
    const tree = await prisma.familyTree.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
      include: { shares: true },
    });
    if (!tree) return res.status(404).json({ error: 'Tree not found' });

    if (tree.shares.length > 0) {
      return res.json({ shareToken: tree.shares[0].shareToken });
    }

    const shareToken = uuidv4();
    await prisma.treeShare.create({
      data: { treeId: tree.id, shareToken },
    });
    res.json({ shareToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trees/:id/kinship/:perspectiveId — compute kinship titles
router.get('/:id/kinship/:perspectiveId', requireAuth, async (req, res) => {
  try {
    const tree = await prisma.familyTree.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
      include: { people: true, relationships: true, titleOverrides: true },
    });
    if (!tree) return res.status(404).json({ error: 'Tree not found' });

    const kinship = computeKinship(
      tree.people,
      tree.relationships,
      req.params.perspectiveId,
      tree.culture,
      tree.titleOverrides,
      { grandmotherVariant: tree.grandmotherVariant }
    );
    res.json(kinship);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/trees/:id/node-positions — persist canvas node positions
router.patch('/:id/node-positions', requireAuth, async (req, res) => {
  const { positions } = req.body;
  if (!positions || typeof positions !== 'object' || Array.isArray(positions)) {
    return res.status(400).json({ error: 'positions must be an object' });
  }
  try {
    const tree = await prisma.familyTree.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
    });
    if (!tree) return res.status(404).json({ error: 'Tree not found' });

    await prisma.familyTree.update({
      where: { id: req.params.id },
      data: { nodePositionsJson: positions },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/trees/:id/title-overrides — upsert a title override
router.put('/:id/title-overrides', requireAuth, async (req, res) => {
  const { relationshipKey, culture, script, transliteration, english } = req.body;
  if (!relationshipKey || !culture) {
    return res.status(400).json({ error: 'relationshipKey and culture are required' });
  }
  try {
    const tree = await prisma.familyTree.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
    });
    if (!tree) return res.status(404).json({ error: 'Tree not found' });

    const override = await prisma.titleOverride.upsert({
      where: {
        treeId_relationshipKey_culture: {
          treeId: req.params.id,
          relationshipKey,
          culture,
        },
      },
      update: { script, transliteration, english },
      create: { treeId: req.params.id, relationshipKey, culture, script, transliteration, english },
    });
    res.json(override);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
