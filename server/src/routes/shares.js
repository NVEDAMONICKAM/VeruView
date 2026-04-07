const express = require('express');
const prisma = require('../lib/prisma');
const { computeKinship } = require('../lib/kinship');

const router = express.Router();

// GET /api/share/:token — public read-only tree access
router.get('/:token', async (req, res) => {
  try {
    const share = await prisma.treeShare.findUnique({
      where: { shareToken: req.params.token },
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

    const { tree } = share;
    res.json({
      id: tree.id,
      name: tree.name,
      culture: tree.culture,
      people: tree.people,
      relationships: tree.relationships,
      titleOverrides: tree.titleOverrides,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/share/:token/kinship/:perspectiveId — kinship for shared tree
router.get('/:token/kinship/:perspectiveId', async (req, res) => {
  try {
    const share = await prisma.treeShare.findUnique({
      where: { shareToken: req.params.token },
      include: {
        tree: {
          include: { people: true, relationships: true, titleOverrides: true },
        },
      },
    });

    if (!share) return res.status(404).json({ error: 'Share link not found' });

    const { tree } = share;
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

module.exports = router;
