const express = require('express');
const multer = require('multer');
const path = require('path');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// Multer config — store profile photos in /uploads, named by timestamp+original
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Verify the tree belongs to the current user
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

// GET /api/trees/:treeId/people
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!(await verifyTreeOwner(req, res))) return;
    const people = await prisma.person.findMany({
      where: { treeId: req.params.treeId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(people);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trees/:treeId/people
router.post('/', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!(await verifyTreeOwner(req, res))) return;
    const { name, dob, gender } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const person = await prisma.person.create({
      data: {
        treeId: req.params.treeId,
        name,
        dob: dob ? new Date(dob) : null,
        gender: gender || 'OTHER',
        photoUrl,
      },
    });
    res.status(201).json(person);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/trees/:treeId/people/:id
router.put('/:id', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!(await verifyTreeOwner(req, res))) return;
    const person = await prisma.person.findFirst({
      where: { id: req.params.id, treeId: req.params.treeId },
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const { name, dob, gender } = req.body;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : person.photoUrl;

    const updated = await prisma.person.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        dob: dob !== undefined ? (dob ? new Date(dob) : null) : person.dob,
        ...(gender !== undefined && { gender }),
        photoUrl,
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/trees/:treeId/people/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!(await verifyTreeOwner(req, res))) return;
    const person = await prisma.person.findFirst({
      where: { id: req.params.id, treeId: req.params.treeId },
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    await prisma.person.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
