'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');

const store = require('./store');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(12).toString('hex') + (ALLOWED.has(ext) ? ext : '.img');
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024, files: 30 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED.has(ext) && /^image\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Nur Bilddateien sind erlaubt (jpg, png, gif, webp, bmp, avif).'));
  },
});

const router = express.Router();

function parseList(value) {
  // Accepts a JSON array string, a single value, or an array (repeated fields).
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        /* fall through */
      }
    }
    if (!t) return [];
    return t.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean);
  }
  return [value];
}

/* ------------------------------- Categories ------------------------------ */

router.get('/categories', (_req, res) => {
  res.json(store.listCategories());
});

router.post('/categories', (req, res) => {
  try {
    const cat = store.createCategory(req.body.name);
    res.status(201).json(cat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/categories/:id', (req, res) => {
  try {
    res.json(store.renameCategory(Number(req.params.id), req.body.name));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/categories/:id', (req, res) => {
  store.deleteCategory(Number(req.params.id));
  res.status(204).end();
});

/* --------------------------------- Images -------------------------------- */

router.get('/images', (req, res) => {
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
  res.json(store.listImages({ categoryId }));
});

// Upload one or more image files. Shared answers/categories can be applied to
// all files in the batch (handy for bulk uploads of the same subject), or a
// single file with its own answers.
router.post('/images', upload.array('images', 30), (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'Keine Datei hochgeladen.' });
  }
  const answers = parseList(req.body.answers);
  const categoryIds = parseList(req.body.categoryIds).map(Number).filter((n) => Number.isFinite(n));

  if (answers.length === 0) {
    // Clean up the orphaned uploads.
    for (const f of files) fs.unlink(path.join(UPLOAD_DIR, f.filename), () => {});
    return res.status(400).json({ error: 'Mindestens eine Antwort ist erforderlich.' });
  }

  try {
    const created = files.map((f) =>
      store.createImage({
        filename: f.filename,
        originalName: f.originalname,
        answers,
        categoryIds,
      })
    );
    res.status(201).json(created);
  } catch (err) {
    for (const f of files) fs.unlink(path.join(UPLOAD_DIR, f.filename), () => {});
    res.status(400).json({ error: err.message });
  }
});

router.put('/images/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const patch = {};
    if (req.body.answers !== undefined) patch.answers = parseList(req.body.answers);
    if (req.body.categoryIds !== undefined) {
      patch.categoryIds = parseList(req.body.categoryIds).map(Number).filter((n) => Number.isFinite(n));
    }
    const updated = store.updateImage(id, patch);
    if (!updated) return res.status(404).json({ error: 'Bild nicht gefunden.' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/images/:id', (req, res) => {
  const filename = store.deleteImage(Number(req.params.id));
  if (filename) {
    fs.unlink(path.join(UPLOAD_DIR, filename), () => {});
  }
  res.status(204).end();
});

router.get('/stats', (_req, res) => {
  res.json({
    images: store.countImages(),
    categories: store.listCategories().length,
  });
});

// Multer / upload errors arrive here.
router.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Upload-Fehler.' });
});

module.exports = router;
