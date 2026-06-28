'use strict';

const db = require('./db');

function now() {
  return Date.now();
}

// Run fn inside a transaction; rolls back on error.
function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/* ------------------------------- Categories ------------------------------ */

const stmtListCategories = db.prepare(`
  SELECT c.id, c.name,
         (SELECT COUNT(*) FROM image_categories ic WHERE ic.category_id = c.id) AS imageCount
  FROM categories c
  ORDER BY c.name COLLATE NOCASE ASC
`);

function listCategories() {
  return stmtListCategories.all().map((r) => ({
    id: r.id,
    name: r.name,
    imageCount: r.imageCount,
  }));
}

const stmtInsertCategory = db.prepare(
  'INSERT INTO categories (name, created_at) VALUES (?, ?)'
);
const stmtCategoryByName = db.prepare(
  'SELECT id, name FROM categories WHERE name = ? COLLATE NOCASE'
);

function createCategory(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Kategoriename darf nicht leer sein.');
  const existing = stmtCategoryByName.get(trimmed);
  if (existing) return { id: existing.id, name: existing.name, imageCount: 0 };
  const info = stmtInsertCategory.run(trimmed, now());
  return { id: Number(info.lastInsertRowid), name: trimmed, imageCount: 0 };
}

const stmtRenameCategory = db.prepare('UPDATE categories SET name = ? WHERE id = ?');
function renameCategory(id, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Kategoriename darf nicht leer sein.');
  stmtRenameCategory.run(trimmed, id);
  return { id: Number(id), name: trimmed };
}

const stmtDeleteCategory = db.prepare('DELETE FROM categories WHERE id = ?');
function deleteCategory(id) {
  stmtDeleteCategory.run(id);
}

/* --------------------------------- Images -------------------------------- */

const stmtInsertImage = db.prepare(
  'INSERT INTO images (filename, original_name, created_at) VALUES (?, ?, ?)'
);
const stmtInsertAnswer = db.prepare(
  'INSERT INTO answers (image_id, text, is_primary) VALUES (?, ?, ?)'
);
const stmtLinkCategory = db.prepare(
  'INSERT OR IGNORE INTO image_categories (image_id, category_id) VALUES (?, ?)'
);

function createImage({ filename, originalName, answers, categoryIds }) {
  const cleanAnswers = (answers || [])
    .map((a) => String(a).trim())
    .filter(Boolean);
  if (cleanAnswers.length === 0) {
    throw new Error('Mindestens eine Antwort ist erforderlich.');
  }
  return tx(() => {
    const info = stmtInsertImage.run(filename, originalName || null, now());
    const imageId = Number(info.lastInsertRowid);
    cleanAnswers.forEach((text, i) => {
      stmtInsertAnswer.run(imageId, text, i === 0 ? 1 : 0);
    });
    for (const cid of categoryIds || []) {
      stmtLinkCategory.run(imageId, cid);
    }
    return getImage(imageId);
  });
}

const stmtDeleteAnswers = db.prepare('DELETE FROM answers WHERE image_id = ?');
const stmtDeleteImageCats = db.prepare('DELETE FROM image_categories WHERE image_id = ?');

function updateImage(id, { answers, categoryIds }) {
  return tx(() => {
    if (answers) {
      const cleanAnswers = answers.map((a) => String(a).trim()).filter(Boolean);
      if (cleanAnswers.length === 0) {
        throw new Error('Mindestens eine Antwort ist erforderlich.');
      }
      stmtDeleteAnswers.run(id);
      cleanAnswers.forEach((text, i) => {
        stmtInsertAnswer.run(id, text, i === 0 ? 1 : 0);
      });
    }
    if (categoryIds) {
      stmtDeleteImageCats.run(id);
      for (const cid of categoryIds) stmtLinkCategory.run(id, cid);
    }
    return getImage(id);
  });
}

const stmtImageById = db.prepare(
  'SELECT id, filename, original_name, created_at FROM images WHERE id = ?'
);
const stmtAnswersByImage = db.prepare(
  'SELECT text, is_primary FROM answers WHERE image_id = ? ORDER BY is_primary DESC, id ASC'
);
const stmtCatsByImage = db.prepare(`
  SELECT c.id, c.name FROM categories c
  JOIN image_categories ic ON ic.category_id = c.id
  WHERE ic.image_id = ?
  ORDER BY c.name COLLATE NOCASE
`);

function hydrateImage(row) {
  const answers = stmtAnswersByImage.all(row.id);
  const categories = stmtCatsByImage.all(row.id);
  return {
    id: row.id,
    filename: row.filename,
    url: '/uploads/' + row.filename,
    originalName: row.original_name,
    createdAt: row.created_at,
    answers: answers.map((a) => a.text),
    primaryAnswer: answers.length ? answers[0].text : null,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
  };
}

function getImage(id) {
  const row = stmtImageById.get(id);
  return row ? hydrateImage(row) : null;
}

const stmtAllImages = db.prepare('SELECT id, filename, original_name, created_at FROM images ORDER BY created_at DESC');
const stmtImagesByCategory = db.prepare(`
  SELECT i.id, i.filename, i.original_name, i.created_at
  FROM images i
  JOIN image_categories ic ON ic.image_id = i.id
  WHERE ic.category_id = ?
  ORDER BY i.created_at DESC
`);

function listImages({ categoryId } = {}) {
  const rows = categoryId ? stmtImagesByCategory.all(categoryId) : stmtAllImages.all();
  return rows.map(hydrateImage);
}

const stmtDeleteImage = db.prepare('DELETE FROM images WHERE id = ?');
function deleteImage(id) {
  const img = stmtImageById.get(id);
  if (!img) return null;
  stmtDeleteImage.run(id); // cascades to answers + image_categories
  return img.filename;
}

function countImages() {
  return db.prepare('SELECT COUNT(*) AS n FROM images').get().n;
}

/* ------------------------- Pool building for games ----------------------- */

// Build the playable pool of images from a set of category ids and/or
// explicit image ids. If both are empty and fallbackAll is true, returns all
// images; with fallbackAll false an empty selection yields an empty pool.
function buildPool({ categoryIds, imageIds, fallbackAll = true } = {}) {
  const ids = new Set();

  const hasCats = Array.isArray(categoryIds) && categoryIds.length > 0;
  const hasImgs = Array.isArray(imageIds) && imageIds.length > 0;

  if (hasCats) {
    const placeholders = categoryIds.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT DISTINCT image_id AS id FROM image_categories WHERE category_id IN (${placeholders})`)
      .all(...categoryIds);
    for (const r of rows) ids.add(r.id);
  }
  if (hasImgs) {
    for (const id of imageIds) ids.add(Number(id));
  }
  if (!hasCats && !hasImgs && fallbackAll) {
    for (const r of stmtAllImages.all()) ids.add(r.id);
  }

  const pool = [];
  for (const id of ids) {
    const img = getImage(id);
    if (img && img.answers.length) pool.push(img);
  }
  return pool;
}

// A random selection of primary answers (for generating multiple-choice
// distractors), excluding the given answer text.
function randomDistractors(excludePrimary, count) {
  const rows = db
    .prepare('SELECT text FROM answers WHERE is_primary = 1 ORDER BY RANDOM() LIMIT ?')
    .all(count + 8);
  const seen = new Set([String(excludePrimary || '').toLowerCase()]);
  const out = [];
  for (const r of rows) {
    const key = r.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r.text);
    if (out.length >= count) break;
  }
  return out;
}

module.exports = {
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
  createImage,
  updateImage,
  getImage,
  listImages,
  deleteImage,
  countImages,
  buildPool,
  randomDistractors,
};
