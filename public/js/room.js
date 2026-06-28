// Room page: lobby configuration + live gameplay over Socket.IO.

const params = new URLSearchParams(location.search);
const initialCode = (params.get('code') || '').toUpperCase();
const myId = getClientId();

const socket = io();
const mainEl = document.getElementById('main');
const playersEl = document.getElementById('players');
const playerCountEl = document.getElementById('playerCount');
const chatlogEl = document.getElementById('chatlog');

let roomState = null;     // last room:state payload
let view = 'lobby';       // 'lobby' | 'waiting' | 'playing' | 'results' | 'final'
let roundData = null;     // last round:start
let resultData = null;    // last round:end
let finalData = null;     // last game:end
let answeredSet = new Set();
let timerRAF = null;
let locked = false;

// Host-side lobby config (client state mirrored to server).
let selectionMode = 'categories'; // 'categories' | 'images'
let selectedCategoryIds = new Set();
let selectedImageIds = new Set();
let allImagesCache = null;
let lobbyBuilt = false;

const isHost = () => roomState && roomState.hostClientId === myId;

/* ------------------------------- Connect -------------------------------- */

socket.on('connect', () => {
  if (!initialCode) { location.href = '/'; return; }
  socket.emit('room:join', { code: initialCode, name: getNick(), clientId: myId }, (res) => {
    if (!res || res.error) {
      toast((res && res.error) || 'Beitritt fehlgeschlagen.', 'error');
      setTimeout(() => (location.href = '/'), 1500);
    }
  });
});

document.getElementById('codeText').textContent = initialCode || '····';
document.getElementById('copyCode').addEventListener('click', () => {
  navigator.clipboard?.writeText(initialCode).then(
    () => toast('Code kopiert!', 'ok'),
    () => toast('Kopieren nicht möglich', 'error')
  );
});

/* ------------------------------- Events --------------------------------- */

socket.on('room:state', (s) => {
  roomState = s;
  document.getElementById('codeText').textContent = s.code;
  renderSidebar();
  reconcileView(s);
  renderMain();
});

socket.on('round:start', (data) => {
  roundData = data;
  resultData = null;
  locked = false;
  answeredSet = new Set();
  view = 'playing';
  renderMain();
  renderSidebar();
});

socket.on('player:answered', ({ clientId }) => {
  answeredSet.add(clientId);
  renderSidebar();
  const counter = document.getElementById('answeredCount');
  if (counter && roomState) counter.textContent = `${answeredSet.size}/${roomState.players.length} haben geraten`;
});

socket.on('guess:result', (res) => onGuessResult(res));

socket.on('round:end', (data) => {
  resultData = data;
  view = 'results';
  stopTimer();
  renderMain();
  renderSidebar();
});

socket.on('game:end', (data) => {
  finalData = data;
  view = 'final';
  stopTimer();
  renderMain();
});

socket.on('chat', (msg) => addChatLine(msg));

/* ------------------------------ View logic ------------------------------ */

function reconcileView(s) {
  if (s.state === 'lobby') {
    if (view !== 'final') { view = 'lobby'; }
  } else if (s.state === 'playing') {
    if (view !== 'playing') view = roundData ? 'playing' : 'waiting';
  } else if (s.state === 'intermission') {
    if (view !== 'results') view = 'waiting';
  }
}

function renderMain() {
  if (!roomState) { mainEl.innerHTML = '<div class="card center muted">Verbinde…</div>'; return; }
  if (view === 'lobby') return renderLobby();
  if (view === 'playing') return renderPlaying();
  if (view === 'results') return renderResults();
  if (view === 'final') return renderFinal();
  return renderWaiting();
}

function renderWaiting() {
  lobbyBuilt = false;
  mainEl.innerHTML = `<div class="stage"><h3>Gleich geht's weiter…</h3><p class="muted">Die nächste Runde startet in Kürze.</p></div>`;
}

/* -------------------------------- Sidebar ------------------------------- */

function renderSidebar() {
  if (!roomState) return;
  playerCountEl.textContent = roomState.players.length;
  playersEl.innerHTML = '';
  const showMedals = view === 'final' || view === 'results';
  roomState.players.forEach((p, i) => {
    const row = el('div', { class: 'player-row' + (p.connected ? '' : ' disconnected') + (answeredSet.has(p.clientId) ? ' answered' : '') });
    let medal = '';
    if (showMedals) medal = ['🥇', '🥈', '🥉'][i] || '';
    row.appendChild(el('span', { class: 'medal' }, medal || (p.isHost ? '👑' : '')));
    row.appendChild(el('span', { class: 'name' }, p.name + (p.clientId === myId ? ' (du)' : '')));
    row.appendChild(el('span', { class: 'score' }, String(p.score)));
    playersEl.appendChild(row);
  });
}

/* -------------------------------- Lobby --------------------------------- */

function renderLobby() {
  const s = roomState.settings;
  if (lobbyBuilt && document.getElementById('lobbyForm')) { updateLobbyDynamic(); return; }
  lobbyBuilt = true;

  if (!isHost()) {
    mainEl.innerHTML = `
      <div class="card">
        <h2>Lobby</h2>
        <p>Warte, bis der Host das Spiel startet…</p>
        <div id="settingsSummary" class="muted"></div>
      </div>`;
    updateLobbyDynamic();
    return;
  }

  // Sync local selection from server settings on (re)build.
  selectedCategoryIds = new Set(s.categoryIds || []);
  selectedImageIds = new Set(s.imageIds || []);
  if (s.selectionMode === 'images' || s.selectionMode === 'categories') selectionMode = s.selectionMode;

  mainEl.innerHTML = `
    <div class="card" id="lobbyForm">
      <h2>Spiel einrichten</h2>
      <div class="settings-grid">
        <div>
          <label>Runden</label>
          <input type="number" id="setRounds" min="1" max="50" value="${s.rounds}" />
        </div>
        <div>
          <label>Zeit pro Runde (Sek.)</label>
          <input type="number" id="setTime" min="5" max="120" value="${s.roundTime}" />
        </div>
        <div>
          <label>Rate-Modus</label>
          <select id="setMode">
            <option value="type">Namen tippen</option>
            <option value="choice">Multiple Choice</option>
            <option value="mixed">Gemischt</option>
          </select>
        </div>
        <div>
          <label>Ausgewählte Bilder</label>
          <div class="pill" id="poolPill" style="margin-top:6px;">… Bilder</div>
        </div>
      </div>

      <div class="spacer"></div>
      <label>Welche Bilder kommen in die Runde?</label>
      <div class="seg" id="selSeg">
        <button data-mode="categories">Nach Kategorie</button>
        <button data-mode="images">Bilder einzeln wählen</button>
      </div>
      <div class="spacer"></div>
      <div id="selPanel"></div>

      <div class="spacer"></div>
      <button class="btn green block" id="startBtn">▶ Spiel starten</button>
      <p class="muted center" style="margin-top:8px;">Tipp: Lade unter <a href="/manage.html" target="_blank">Bilder verwalten</a> mehr Bilder hoch.</p>
    </div>`;

  document.getElementById('setMode').value = s.mode;

  const pushSettings = () => emitSettings();
  document.getElementById('setRounds').addEventListener('change', pushSettings);
  document.getElementById('setTime').addEventListener('change', pushSettings);
  document.getElementById('setMode').addEventListener('change', pushSettings);

  document.querySelectorAll('#selSeg button').forEach((b) => {
    b.addEventListener('click', () => {
      selectionMode = b.dataset.mode;
      renderSelPanel();
      emitSettings();
    });
  });

  document.getElementById('startBtn').addEventListener('click', () => {
    socket.emit('game:start', {}, (res) => {
      if (res && res.error) toast(res.error, 'error');
    });
  });

  renderSelPanel();
  updateLobbyDynamic();
}

function renderSelPanel() {
  document.querySelectorAll('#selSeg button').forEach((b) =>
    b.classList.toggle('active', b.dataset.mode === selectionMode)
  );
  const panel = document.getElementById('selPanel');
  if (!panel) return;

  if (selectionMode === 'categories') {
    const cats = roomState.categories || [];
    panel.innerHTML = `
      <p class="muted">Wähle Kategorien aus. Nichts ausgewählt = <b>alle Bilder</b>.</p>
      <div class="checkbox-grid" id="catGrid"></div>`;
    const grid = panel.querySelector('#catGrid');
    if (cats.length === 0) {
      grid.innerHTML = '<span class="muted">Noch keine Kategorien. Du spielst mit allen Bildern.</span>';
    }
    cats.forEach((c) => {
      const id = 'cat-' + c.id;
      const wrap = el('label', { class: 'check' },
        el('input', {
          type: 'checkbox', id, value: c.id,
          checked: selectedCategoryIds.has(c.id),
          onchange: (e) => {
            if (e.target.checked) selectedCategoryIds.add(c.id);
            else selectedCategoryIds.delete(c.id);
            emitSettings();
          },
        }),
        `${c.name} (${c.imageCount})`
      );
      grid.appendChild(wrap);
    });
  } else {
    panel.innerHTML = `
      <p class="muted">Hake genau die Bilder an, die vorkommen sollen.</p>
      <div class="row" style="margin-bottom:8px;">
        <button class="btn ghost small" id="pickAll">Alle</button>
        <button class="btn ghost small" id="pickNone">Keine</button>
        <select id="pickFilter" style="flex:1; max-width:220px;"><option value="">Alle Kategorien</option></select>
      </div>
      <div class="img-picker"><div class="pick-grid" id="pickGrid">Lade Bilder…</div></div>`;
    loadImagesForPicker();
    panel.querySelector('#pickAll').addEventListener('click', () => {
      (allImagesCache || []).forEach((im) => selectedImageIds.add(im.id));
      renderPickGrid(); emitSettings();
    });
    panel.querySelector('#pickNone').addEventListener('click', () => {
      selectedImageIds.clear(); renderPickGrid(); emitSettings();
    });
    panel.querySelector('#pickFilter').addEventListener('change', renderPickGrid);
  }
}

async function loadImagesForPicker() {
  if (!allImagesCache) {
    try { allImagesCache = await api('/images'); }
    catch (e) { allImagesCache = []; toast('Bilder konnten nicht geladen werden.', 'error'); }
  }
  // populate filter options
  const filter = document.getElementById('pickFilter');
  if (filter && roomState.categories) {
    roomState.categories.forEach((c) => filter.appendChild(el('option', { value: c.id }, c.name)));
  }
  renderPickGrid();
}

function renderPickGrid() {
  const grid = document.getElementById('pickGrid');
  if (!grid) return;
  const filterVal = document.getElementById('pickFilter')?.value;
  const filterId = filterVal ? Number(filterVal) : null;
  let imgs = allImagesCache || [];
  if (filterId) imgs = imgs.filter((im) => im.categories.some((c) => c.id === filterId));
  grid.innerHTML = '';
  if (imgs.length === 0) {
    grid.innerHTML = '<span class="muted">Keine Bilder. Lade welche unter „Bilder verwalten“ hoch.</span>';
    return;
  }
  imgs.forEach((im) => {
    const sel = selectedImageIds.has(im.id);
    const node = el('div', { class: 'pick' + (sel ? ' sel' : '') },
      el('img', { src: im.url, alt: '', loading: 'lazy' }),
      el('div', { class: 'check-dot' }, sel ? '✓' : ''),
      el('div', { class: 'cap' }, im.primaryAnswer || '')
    );
    node.addEventListener('click', () => {
      if (selectedImageIds.has(im.id)) selectedImageIds.delete(im.id);
      else selectedImageIds.add(im.id);
      renderPickGrid();
      emitSettings();
    });
    grid.appendChild(node);
  });
}

let emitTimer = null;
function emitSettings() {
  if (!isHost()) return;
  clearTimeout(emitTimer);
  emitTimer = setTimeout(() => {
    const settings = {
      rounds: Number(document.getElementById('setRounds')?.value) || roomState.settings.rounds,
      roundTime: Number(document.getElementById('setTime')?.value) || roomState.settings.roundTime,
      mode: document.getElementById('setMode')?.value || roomState.settings.mode,
      selectionMode,
      categoryIds: selectionMode === 'categories' ? [...selectedCategoryIds] : [],
      imageIds: selectionMode === 'images' ? [...selectedImageIds] : [],
    };
    socket.emit('settings:update', settings, (res) => {
      if (res && res.error) toast(res.error, 'error');
    });
  }, 120);
}

function updateLobbyDynamic() {
  if (!roomState) return;
  const pool = roomState.poolSize ?? 0;
  const poolPill = document.getElementById('poolPill');
  if (poolPill) poolPill.textContent = pool + ' Bilder';
  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.disabled = pool === 0;
    startBtn.textContent = pool === 0 ? 'Keine Bilder ausgewählt' : '▶ Spiel starten';
  }
  const summary = document.getElementById('settingsSummary');
  if (summary) {
    const s = roomState.settings;
    const mode = { type: 'Namen tippen', choice: 'Multiple Choice', mixed: 'Gemischt' }[s.mode];
    summary.innerHTML = `${s.rounds} Runden · ${s.roundTime}s pro Runde · ${mode} · ${pool} Bilder`;
  }
}

/* ------------------------------- Playing -------------------------------- */

function renderPlaying() {
  lobbyBuilt = false;
  const d = roundData;
  const choiceMode = d.mode === 'choice';
  mainEl.innerHTML = `
    <div class="stage">
      <div class="row" style="justify-content:space-between;">
        <span class="pill">Runde ${d.round}/${d.totalRounds}</span>
        <span class="pill" id="answeredCount">0/${roomState.players.length} haben geraten</span>
      </div>
      <div class="timerbar" id="timerbar"><div></div></div>
      <img class="stage-image" id="stageImg" src="${escapeHtml(d.imageUrl)}" alt="Errate das Bild" />
      <div class="spacer"></div>
      <div id="answerArea"></div>
    </div>`;

  const area = document.getElementById('answerArea');
  if (choiceMode) {
    const grid = el('div', { class: 'choices', id: 'choices' });
    d.options.forEach((opt, i) => {
      const btn = el('button', { class: 'choice', 'data-i': i }, opt);
      btn.addEventListener('click', () => {
        if (locked) return;
        socket.emit('choice', { index: i });
        document.querySelectorAll('#choices .choice').forEach((b) => (b.disabled = true));
        btn.dataset.picked = '1';
      });
      grid.appendChild(btn);
    });
    area.appendChild(grid);
  } else {
    area.innerHTML = `
      <input type="text" class="guess-input" id="guessInput" placeholder="Antwort tippen…" autocomplete="off" />
      <div class="warmth"><div id="warmthBar"></div></div>
      <p class="muted center" id="guessHint">Tippe los — Treffer wird automatisch erkannt.</p>`;
    const input = document.getElementById('guessInput');
    input.focus();
    let lastSent = '';
    let t = null;
    const send = () => {
      const v = input.value.trim();
      if (!v || v === lastSent || locked) return;
      lastSent = v;
      socket.emit('guess', { text: v });
    };
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(send, 160);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { lastSent = ''; send(); } });
  }

  startTimer(d.endsAt, d.durationMs);
}

function onGuessResult(res) {
  if (res.correct) {
    locked = true;
    const input = document.getElementById('guessInput');
    if (input) {
      input.value = '✔ Richtig!';
      input.disabled = true;
      input.style.color = 'var(--green-d)';
    }
    const warmth = document.getElementById('warmthBar');
    if (warmth) warmth.style.width = '100%';
    const hint = document.getElementById('guessHint');
    if (hint) { hint.textContent = 'Richtig! Warte auf die anderen…'; hint.className = 'badge-correct center'; }
    // choice mode: mark picked button correct
    const picked = document.querySelector('#choices .choice[data-picked="1"]');
    if (picked) picked.classList.add('correct');
  } else if (res.locked) {
    locked = true;
    const picked = document.querySelector('#choices .choice[data-picked="1"]');
    if (picked) picked.classList.add('wrong');
    const hint = document.getElementById('guessHint');
    if (hint) { hint.textContent = 'Leider falsch.'; hint.className = 'badge-wrong center'; }
  } else if (typeof res.closeness === 'number') {
    const warmth = document.getElementById('warmthBar');
    if (warmth) warmth.style.width = Math.round(res.closeness * 100) + '%';
  }
}

/* -------------------------------- Timer --------------------------------- */

function startTimer(endsAt, durationMs) {
  stopTimer();
  const bar = document.getElementById('timerbar');
  const fill = bar?.querySelector('div');
  const tick = () => {
    const left = Math.max(0, endsAt - Date.now());
    const frac = Math.max(0, Math.min(1, left / durationMs));
    if (fill) fill.style.width = (frac * 100) + '%';
    if (bar) bar.classList.toggle('low', frac < 0.25);
    if (left > 0) timerRAF = requestAnimationFrame(tick);
  };
  tick();
}
function stopTimer() {
  if (timerRAF) cancelAnimationFrame(timerRAF);
  timerRAF = null;
}

/* ------------------------------- Results -------------------------------- */

function renderResults() {
  lobbyBuilt = false;
  const d = resultData;
  const alts = (d.allAnswers || []).filter((a) => a.toLowerCase() !== (d.answer || '').toLowerCase());
  mainEl.innerHTML = `
    <div class="stage">
      <span class="pill">Runde ${d.round}/${d.totalRounds} — Auflösung</span>
      <img class="stage-image" src="${escapeHtml(d.imageUrl)}" alt="" style="max-height:34vh;" />
      <div class="answer-reveal">${escapeHtml(d.answer)}</div>
      ${alts.length ? `<p class="muted">auch akzeptiert: ${escapeHtml(alts.join(', '))}</p>` : ''}
      <div id="roundResults" style="margin-top:10px;"></div>
    </div>`;
  const wrap = document.getElementById('roundResults');
  d.results.forEach((r) => {
    const row = el('div', { class: 'player-row' + (r.answered && r.gained > 0 ? ' answered' : '') },
      el('span', { class: 'name' }, r.name),
      el('span', {}, r.gained > 0 ? (r.timeMs != null ? (r.timeMs / 1000).toFixed(1) + 's' : '') : (r.answered ? 'falsch' : '—')),
      el('span', { class: 'score' }, r.gained > 0 ? '+' + r.gained : '0')
    );
    wrap.appendChild(row);
  });
}

/* -------------------------------- Final --------------------------------- */

function renderFinal() {
  lobbyBuilt = false;
  const lb = finalData.leaderboard || [];
  const winner = lb[0];
  mainEl.innerHTML = `
    <div class="stage">
      <h2 style="color:var(--ink);">🏆 Endergebnis</h2>
      ${winner ? `<div class="answer-reveal">${escapeHtml(winner.name)} gewinnt!</div>` : ''}
      <div id="finalBoard" style="margin:12px 0;"></div>
      ${isHost() ? '<button class="btn green" id="backLobby">Zurück zur Lobby</button>' : '<p class="muted">Warte auf den Host für eine neue Runde.</p>'}
    </div>`;
  const board = document.getElementById('finalBoard');
  lb.forEach((p, i) => {
    board.appendChild(el('div', { class: 'player-row' },
      el('span', { class: 'medal' }, ['🥇', '🥈', '🥉'][i] || (i + 1) + '.'),
      el('span', { class: 'name' }, p.name),
      el('span', { class: 'score' }, String(p.score))
    ));
  });
  const back = document.getElementById('backLobby');
  if (back) back.addEventListener('click', () => { view = 'lobby'; lobbyBuilt = false; renderMain(); });
}

/* --------------------------------- Chat --------------------------------- */

function addChatLine(msg) {
  const atBottom = chatlogEl.scrollHeight - chatlogEl.scrollTop - chatlogEl.clientHeight < 30;
  const line = el('div', { class: 'chat-line' },
    el('span', { class: 'who', style: msg.clientId === myId ? 'color:var(--primary-d)' : '' }, msg.from + ': '),
    document.createTextNode(msg.text)
  );
  chatlogEl.appendChild(line);
  if (atBottom) chatlogEl.scrollTop = chatlogEl.scrollHeight;
}

function sendChat() {
  const input = document.getElementById('chatinput');
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chat', { text });
  input.value = '';
}
document.getElementById('chatsend').addEventListener('click', sendChat);
document.getElementById('chatinput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

document.getElementById('leave').addEventListener('click', () => { /* navigates to / via href */ });
