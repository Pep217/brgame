// Manage page: upload images, assign categories + answers, edit/delete.

let categories = [];
let images = [];
let pendingFiles = [];

const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const previewRow = document.getElementById('previewRow');
const answersEl = document.getElementById('answers');
const uploadCatsEl = document.getElementById('uploadCats');
const uploadBtn = document.getElementById('uploadBtn');
const uploadHint = document.getElementById('uploadHint');
const catListEl = document.getElementById('catList');
const galleryEl = document.getElementById('gallery');
const galleryFilter = document.getElementById('galleryFilter');

/* ------------------------------- Loading -------------------------------- */

async function loadAll() {
  await Promise.all([loadCategories(), loadImages()]);
}

async function loadCategories() {
  categories = await api('/categories');
  renderCategories();
  renderUploadCats();
  renderGalleryFilter();
}

async function loadImages() {
  const filter = galleryFilter.value ? '?categoryId=' + galleryFilter.value : '';
  images = await api('/images' + filter);
  renderGallery();
}

/* ------------------------------ Categories ------------------------------ */

function renderCategories() {
  catListEl.innerHTML = '';
  document.getElementById('catEmpty').textContent = categories.length ? '' : 'Noch keine Kategorien angelegt.';
  categories.forEach((c) => {
    const item = el('div', { class: 'cat-item' },
      el('span', { class: 'name' }, c.name),
      el('span', { class: 'pill' }, c.imageCount + ' Bilder'),
      el('button', { class: 'btn ghost small', onclick: () => renameCategory(c) }, '✎'),
      el('button', { class: 'btn danger small', onclick: () => deleteCategory(c) }, '🗑')
    );
    catListEl.appendChild(item);
  });
}

document.getElementById('addCat').addEventListener('click', addCategory);
document.getElementById('newCat').addEventListener('keydown', (e) => { if (e.key === 'Enter') addCategory(); });

async function addCategory() {
  const input = document.getElementById('newCat');
  const name = input.value.trim();
  if (!name) return;
  try {
    await api('/categories', { method: 'POST', body: JSON.stringify({ name }) });
    input.value = '';
    await loadCategories();
    toast('Kategorie angelegt.', 'ok');
  } catch (e) { toast(e.message, 'error'); }
}

async function renameCategory(c) {
  const name = prompt('Kategorie umbenennen:', c.name);
  if (!name || name.trim() === c.name) return;
  try {
    await api('/categories/' + c.id, { method: 'PUT', body: JSON.stringify({ name: name.trim() }) });
    await loadCategories();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteCategory(c) {
  if (!confirm(`Kategorie „${c.name}“ löschen?\n(Die Bilder bleiben erhalten, verlieren aber diese Kategorie.)`)) return;
  await api('/categories/' + c.id, { method: 'DELETE' });
  await loadAll();
}

function renderUploadCats() {
  uploadCatsEl.innerHTML = '';
  if (categories.length === 0) {
    uploadCatsEl.innerHTML = '<span class="muted">Noch keine Kategorien — du kannst sie rechts anlegen.</span>';
    return;
  }
  categories.forEach((c) => {
    uploadCatsEl.appendChild(
      el('label', { class: 'check' },
        el('input', { type: 'checkbox', value: c.id, 'data-upcat': '1' }),
        c.name)
    );
  });
}

function renderGalleryFilter() {
  const cur = galleryFilter.value;
  galleryFilter.innerHTML = '<option value="">Alle Kategorien</option>';
  categories.forEach((c) => galleryFilter.appendChild(el('option', { value: c.id }, c.name)));
  galleryFilter.value = cur;
}
galleryFilter.addEventListener('change', loadImages);

/* -------------------------------- Upload -------------------------------- */

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  addFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => addFiles(fileInput.files));

function addFiles(fileList) {
  for (const f of fileList) {
    if (f.type.startsWith('image/')) pendingFiles.push(f);
  }
  renderPreviews();
}

function renderPreviews() {
  previewRow.innerHTML = '';
  pendingFiles.forEach((f, i) => {
    const url = URL.createObjectURL(f);
    const img = el('img', { src: url, title: f.name });
    const x = el('span', {
      style: 'cursor:pointer;color:var(--red);font-weight:800;align-self:center;',
      onclick: () => { pendingFiles.splice(i, 1); renderPreviews(); },
    }, '✕');
    previewRow.appendChild(el('span', { style: 'display:inline-flex;gap:2px;align-items:center;' }, img, x));
  });
  uploadBtn.disabled = pendingFiles.length === 0;
  uploadHint.textContent = pendingFiles.length
    ? `${pendingFiles.length} Bild(er) bereit. Antwort gilt für alle in diesem Upload.`
    : '';
}

uploadBtn.addEventListener('click', doUpload);

async function doUpload() {
  const answers = answersEl.value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (pendingFiles.length === 0) return;
  if (answers.length === 0) { toast('Bitte mindestens eine Antwort eingeben.', 'error'); answersEl.focus(); return; }

  const catIds = [...uploadCatsEl.querySelectorAll('input[data-upcat]:checked')].map((c) => c.value);

  const fd = new FormData();
  pendingFiles.forEach((f) => fd.append('images', f));
  fd.append('answers', JSON.stringify(answers));
  fd.append('categoryIds', JSON.stringify(catIds));

  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Lädt hoch…';
  try {
    const created = await api('/images', { method: 'POST', body: fd });
    toast(`${created.length} Bild(er) hochgeladen.`, 'ok');
    pendingFiles = [];
    answersEl.value = '';
    uploadCatsEl.querySelectorAll('input:checked').forEach((c) => (c.checked = false));
    renderPreviews();
    await loadAll();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    uploadBtn.disabled = pendingFiles.length === 0;
    uploadBtn.textContent = 'Hochladen';
  }
}

/* ------------------------------- Gallery -------------------------------- */

function renderGallery() {
  document.getElementById('imgCount').textContent = images.length;
  galleryEl.innerHTML = '';
  document.getElementById('galleryEmpty').textContent = images.length ? '' : 'Noch keine Bilder hochgeladen.';
  images.forEach((im) => {
    const tags = im.categories.map((c) => el('span', { class: 'tag' }, c.name));
    const thumb = el('div', { class: 'thumb' },
      el('img', { src: im.url, alt: im.primaryAnswer || '', loading: 'lazy' }),
      el('div', { class: 'meta' },
        el('div', { class: 'answer' }, im.primaryAnswer || '(ohne Antwort)'),
        im.answers.length > 1 ? el('div', { class: 'muted', style: 'font-size:12px;' }, '+ ' + (im.answers.length - 1) + ' weitere') : null,
        el('div', {}, tags.length ? tags : el('span', { class: 'muted', style: 'font-size:12px;' }, 'keine Kategorie'))
      ),
      el('div', { class: 'actions' },
        el('button', { class: 'btn ghost small', onclick: () => editImage(im) }, '✎ Bearbeiten'),
        el('button', { class: 'btn danger small', onclick: () => deleteImage(im) }, '🗑')
      )
    );
    galleryEl.appendChild(thumb);
  });
}

async function deleteImage(im) {
  if (!confirm('Dieses Bild löschen?')) return;
  await api('/images/' + im.id, { method: 'DELETE' });
  await loadAll();
}

/* ------------------------------ Edit modal ------------------------------ */

function editImage(im) {
  const selected = new Set(im.categories.map((c) => c.id));
  const catChecks = categories.map((c) =>
    el('label', { class: 'check' },
      el('input', { type: 'checkbox', value: c.id, checked: selected.has(c.id), 'data-editcat': '1' }),
      c.name)
  );
  const modalBg = el('div', { class: 'modal-bg' });
  const modal = el('div', { class: 'modal' },
    el('h3', {}, 'Bild bearbeiten'),
    el('img', { src: im.url, style: 'width:100%;max-height:200px;object-fit:contain;border-radius:10px;background:var(--panel-2);' }),
    el('div', { class: 'spacer' }),
    el('label', {}, 'Antwort(en) — eine pro Zeile'),
    el('textarea', { id: 'editAnswers' }, im.answers.join('\n')),
    el('div', { class: 'spacer' }),
    el('label', {}, 'Kategorien'),
    el('div', { class: 'checkbox-grid' }, catChecks.length ? catChecks : el('span', { class: 'muted' }, 'Keine Kategorien angelegt.')),
    el('div', { class: 'spacer' }),
    el('div', { class: 'row', style: 'justify-content:flex-end;' },
      el('button', { class: 'btn ghost', onclick: () => modalBg.remove() }, 'Abbrechen'),
      el('button', { class: 'btn green', onclick: save }, 'Speichern')
    )
  );
  modalBg.appendChild(modal);
  modalBg.addEventListener('click', (e) => { if (e.target === modalBg) modalBg.remove(); });
  document.getElementById('modalHost').appendChild(modalBg);

  async function save() {
    const answers = modal.querySelector('#editAnswers').value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (answers.length === 0) { toast('Mindestens eine Antwort nötig.', 'error'); return; }
    const categoryIds = [...modal.querySelectorAll('input[data-editcat]:checked')].map((c) => Number(c.value));
    try {
      await api('/images/' + im.id, { method: 'PUT', body: JSON.stringify({ answers, categoryIds }) });
      modalBg.remove();
      await loadAll();
      toast('Gespeichert.', 'ok');
    } catch (e) { toast(e.message, 'error'); }
  }
}

loadAll().catch((e) => toast(e.message, 'error'));
