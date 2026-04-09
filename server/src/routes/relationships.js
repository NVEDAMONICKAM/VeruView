const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

async function verifyTreeOwner(req, res) {
  const tree = await prisma.familyTree.findFirst({
    where: { id: req.params.treeId, ownerId: req.user.id },
  });
  if (!tree) {
    res.status(404).json({ error: 'Tree not found' });
    return null;
  }
  return tree;
}

// GET /api/trees/:treeId/relationships
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!(await verifyTreeOwner(req, res))) return;
    const rels = await prisma.relationship.findMany({
      where: { treeId: req.params.treeId },
    });
    res.json(rels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trees/:treeId/relationships
router.post('/', requireAuth, async (req, res) => {
  const { fromPersonId, toPersonId, type, isBiological = true } = req.body;
  if (!fromPersonId || !toPersonId || !type) {
    return res.status(400).json({ error: 'fromPersonId, toPersonId, and type are required' });
  }

  const validTypes = ['PARENT', 'CHILD', 'SPOUSE', 'SIBLING'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of ${validTypes.join(', ')}` });
  }

  try {
    if (!(await verifyTreeOwner(req, res))) return;

    // Verify both people belong to this tree
    const [from, to] = await Promise.all([
      prisma.person.findFirst({ where: { id: fromPersonId, treeId: req.params.treeId } }),
      prisma.person.findFirst({ where: { id: toPersonId, treeId: req.params.treeId } }),
    ]);
    if (!from || !to) {
      return res.status(400).json({ error: 'Both people must belong to this tree' });
    }

    const rel = await prisma.relationship.create({
      data: {
        treeId: req.params.treeId,
        fromPersonId,
        toPersonId,
        type,
        isBiological: (type === 'PARENT' || type === 'CHILD') ? Boolean(isBiological) : true,
      },
    });
    res.status(201).json(rel);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'This relationship already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/trees/:treeId/relationships/:id — update type and/or isBiological
router.put('/:id', requireAuth, async (req, res) => {
  const { type, isBiological } = req.body;
  if (type === undefined && isBiological === undefined) {
    return res.status(400).json({ error: 'type or isBiological is required' });
  }

  try {
    if (!(await verifyTreeOwner(req, res))) return;
    const rel = await prisma.relationship.findFirst({
      where: { id: req.params.id, treeId: req.params.treeId },
    });
    if (!rel) return res.status(404).json({ error: 'Relationship not found' });

    const updated = await prisma.relationship.update({
      where: { id: req.params.id },
      data: {
        ...(type !== undefined && { type }),
        ...(isBiological !== undefined && { isBiological: Boolean(isBiological) }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/trees/:treeId/relationships/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!(await verifyTreeOwner(req, res))) return;
    const rel = await prisma.relationship.findFirst({
      where: { id: req.params.id, treeId: req.params.treeId },
    });
    if (!rel) return res.status(404).json({ error: 'Relationship not found' });

    await prisma.relationship.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
