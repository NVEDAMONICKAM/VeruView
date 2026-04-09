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

// PUT /api/trees/:id — update name or culture
router.put('/:id', requireAuth, async (req, res) => {
  const { name, culture } = req.body;
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
      tree.titleOverrides
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
