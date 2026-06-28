'use strict';

const store = require('./store');
const { checkGuess, closeness } = require('./matching');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
const DEFAULT_SETTINGS = {
  rounds: 10,
  roundTime: 25, // seconds
  mode: 'type', // 'type' | 'choice' | 'mixed'
  selectionMode: 'categories', // 'categories' (empty = all) | 'images' (explicit)
  categoryIds: [], // empty = all categories
  imageIds: [], // explicit image selection (used when selectionMode === 'images')
};

const INTERMISSION_MS = 6000; // pause between rounds
const ALL_ANSWERED_GRACE_MS = 1500; // linger after everyone got it

/** @type {Map<string, Room>} */
const rooms = new Map();

function genCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  } while (rooms.has(code));
  return code;
}

function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeSettings(raw, current) {
  const base = current || DEFAULT_SETTINGS;
  const s = { ...base, ...(raw || {}) };
  return {
    rounds: clampInt(s.rounds, 1, 50, base.rounds),
    roundTime: clampInt(s.roundTime, 5, 120, base.roundTime),
    mode: ['type', 'choice', 'mixed'].includes(s.mode) ? s.mode : base.mode,
    selectionMode: ['categories', 'images'].includes(s.selectionMode) ? s.selectionMode : base.selectionMode,
    categoryIds: Array.isArray(s.categoryIds) ? s.categoryIds.map(Number).filter(Number.isFinite) : [],
    imageIds: Array.isArray(s.imageIds) ? s.imageIds.map(Number).filter(Number.isFinite) : [],
  };
}

// Translate room settings into buildPool arguments. In "images" mode the
// explicit list is authoritative (empty = empty pool); in "categories" mode an
// empty category list means "all images".
function poolArgsFor(settings) {
  if (settings.selectionMode === 'images') {
    return { imageIds: settings.imageIds, categoryIds: [], fallbackAll: false };
  }
  return { categoryIds: settings.categoryIds, imageIds: [], fallbackAll: true };
}

function poolSizeFor(settings) {
  return store.buildPool(poolArgsFor(settings)).length;
}

/* --------------------------------- Room ---------------------------------- */

function createRoom(code) {
  return {
    code,
    hostClientId: null,
    players: new Map(), // clientId -> player
    settings: { ...DEFAULT_SETTINGS },
    state: 'lobby', // 'lobby' | 'playing' | 'intermission'
    round: 0,
    totalRounds: 0,
    pool: [],
    usedImageIds: new Set(),
    current: null, // { image, mode, options, correctIndex, startTime, endsAt }
    answered: new Map(), // clientId -> { timeMs, gained }
    roundTimer: null,
    intermissionTimer: null,
    emptyTimer: null,
  };
}

function publicPlayers(room) {
  return [...room.players.values()]
    .map((p) => ({
      clientId: p.clientId,
      name: p.name,
      score: p.score,
      connected: p.connected,
      isHost: p.clientId === room.hostClientId,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function leaderboard(room) {
  return publicPlayers(room).map((p, i) => ({ ...p, rank: i + 1 }));
}

function clearTimers(room) {
  if (room.roundTimer) clearTimeout(room.roundTimer);
  if (room.intermissionTimer) clearTimeout(room.intermissionTimer);
  room.roundTimer = null;
  room.intermissionTimer = null;
}

/* ------------------------------ Game engine ------------------------------ */

function init(io) {
  function broadcastState(room) {
    io.to(room.code).emit('room:state', {
      code: room.code,
      state: room.state,
      hostClientId: room.hostClientId,
      players: publicPlayers(room),
      settings: room.settings,
      poolSize: poolSizeFor(room.settings),
      round: room.round,
      totalRounds: room.totalRounds,
      categories: store.listCategories(),
    });
  }

  function pickImage(room) {
    let candidates = room.pool.filter((img) => !room.usedImageIds.has(img.id));
    if (candidates.length === 0) {
      room.usedImageIds.clear();
      candidates = room.pool;
    }
    const img = candidates[Math.floor(Math.random() * candidates.length)];
    room.usedImageIds.add(img.id);
    return img;
  }

  function startRound(room) {
    room.round += 1;
    room.answered = new Map();

    const image = pickImage(room);
    let mode = room.settings.mode;
    if (mode === 'mixed') mode = Math.random() < 0.5 ? 'type' : 'choice';

    let options = null;
    let correctIndex = -1;
    if (mode === 'choice') {
      const distractors = store.randomDistractors(image.primaryAnswer, 3);
      if (distractors.length < 1) {
        mode = 'type'; // not enough material for choices
      } else {
        const opts = [image.primaryAnswer, ...distractors];
        // shuffle
        for (let i = opts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [opts[i], opts[j]] = [opts[j], opts[i]];
        }
        options = opts;
        correctIndex = opts.indexOf(image.primaryAnswer);
      }
    }

    const startTime = Date.now();
    const endsAt = startTime + room.settings.roundTime * 1000;
    room.current = { image, mode, options, correctIndex, startTime, endsAt };
    room.state = 'playing';

    io.to(room.code).emit('round:start', {
      round: room.round,
      totalRounds: room.totalRounds,
      imageUrl: image.url,
      mode,
      options, // null in type mode
      durationMs: room.settings.roundTime * 1000,
      endsAt,
    });
    broadcastState(room);

    clearTimers(room);
    room.roundTimer = setTimeout(() => endRound(room), room.settings.roundTime * 1000);
  }

  function connectedCount(room) {
    let n = 0;
    for (const p of room.players.values()) if (p.connected) n++;
    return n;
  }

  function maybeEndEarly(room) {
    if (room.state !== 'playing') return;
    if (connectedCount(room) > 0 && room.answered.size >= connectedCount(room)) {
      clearTimers(room);
      room.roundTimer = setTimeout(() => endRound(room), ALL_ANSWERED_GRACE_MS);
    }
  }

  function endRound(room) {
    clearTimers(room);
    if (!room.current) return;
    const { image } = room.current;

    const results = [...room.players.values()].map((p) => {
      const a = room.answered.get(p.clientId);
      return {
        clientId: p.clientId,
        name: p.name,
        answered: !!a,
        gained: a ? a.gained : 0,
        timeMs: a ? a.timeMs : null,
      };
    });

    room.state = 'intermission';
    io.to(room.code).emit('round:end', {
      round: room.round,
      totalRounds: room.totalRounds,
      answer: image.primaryAnswer,
      allAnswers: image.answers,
      imageUrl: image.url,
      results: results.sort((a, b) => b.gained - a.gained),
      leaderboard: leaderboard(room),
    });
    room.current = null;
    broadcastState(room);

    if (room.round >= room.totalRounds) {
      room.intermissionTimer = setTimeout(() => endGame(room), INTERMISSION_MS);
    } else {
      room.intermissionTimer = setTimeout(() => startRound(room), INTERMISSION_MS);
    }
  }

  function endGame(room) {
    clearTimers(room);
    room.state = 'lobby';
    const final = leaderboard(room);
    room.round = 0;
    room.totalRounds = 0;
    room.usedImageIds.clear();
    room.pool = [];
    io.to(room.code).emit('game:end', { leaderboard: final });
    broadcastState(room);
  }

  function startGame(room) {
    const pool = store.buildPool(poolArgsFor(room.settings));
    if (pool.length === 0) {
      return { error: 'Keine Bilder in der Auswahl. Lade Bilder hoch oder wähle Kategorien aus.' };
    }
    room.pool = pool;
    room.usedImageIds = new Set();
    room.round = 0;
    room.totalRounds = room.settings.rounds;
    // reset scores
    for (const p of room.players.values()) p.score = 0;
    startRound(room);
    return { ok: true };
  }

  function reassignHostIfNeeded(room) {
    const host = room.players.get(room.hostClientId);
    if (host && host.connected) return;
    const next = [...room.players.values()].find((p) => p.connected);
    room.hostClientId = next ? next.clientId : room.hostClientId;
  }

  function scheduleEmptyCleanup(room) {
    if (room.emptyTimer) clearTimeout(room.emptyTimer);
    room.emptyTimer = setTimeout(() => {
      if (connectedCount(room) === 0) {
        clearTimers(room);
        rooms.delete(room.code);
      }
    }, 60000);
  }

  io.on('connection', (socket) => {
    function joinRoom(room, clientId, name) {
      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.clientId = clientId;

      let player = room.players.get(clientId);
      const cleanName = String(name || '').trim().slice(0, 24) || 'Spieler';
      if (player) {
        player.connected = true;
        player.socketId = socket.id;
        if (name) player.name = cleanName;
      } else {
        player = {
          clientId,
          socketId: socket.id,
          name: cleanName,
          score: 0,
          connected: true,
        };
        room.players.set(clientId, player);
      }
      if (!room.hostClientId) room.hostClientId = clientId;
      if (room.emptyTimer) {
        clearTimeout(room.emptyTimer);
        room.emptyTimer = null;
      }

      // Bring a (re)joining player up to date with the current round.
      socket.emit('joined', { code: room.code, clientId, hostClientId: room.hostClientId });
      broadcastState(room);
      if (room.state === 'playing' && room.current) {
        const c = room.current;
        socket.emit('round:start', {
          round: room.round,
          totalRounds: room.totalRounds,
          imageUrl: c.image.url,
          mode: c.mode,
          options: c.options,
          durationMs: room.settings.roundTime * 1000,
          endsAt: c.endsAt,
        });
        if (room.answered.has(clientId)) {
          socket.emit('guess:result', { correct: true, locked: true });
        }
      }
    }

    socket.on('room:create', ({ name, clientId } = {}, ack) => {
      if (!clientId) return ack && ack({ error: 'Fehlende Client-ID.' });
      const code = genCode();
      const room = createRoom(code);
      rooms.set(code, room);
      room.hostClientId = clientId;
      joinRoom(room, clientId, name);
      ack && ack({ code });
    });

    socket.on('room:join', ({ code, name, clientId } = {}, ack) => {
      if (!clientId) return ack && ack({ error: 'Fehlende Client-ID.' });
      const room = rooms.get(String(code || '').toUpperCase().trim());
      if (!room) return ack && ack({ error: 'Raum nicht gefunden. Prüfe den Code.' });
      joinRoom(room, clientId, name);
      ack && ack({ code: room.code });
    });

    socket.on('player:rename', ({ name } = {}) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return;
      const player = room.players.get(socket.data.clientId);
      if (!player) return;
      player.name = String(name || '').trim().slice(0, 24) || player.name;
      broadcastState(room);
    });

    socket.on('settings:update', (settings, ack) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return;
      if (socket.data.clientId !== room.hostClientId) {
        return ack && ack({ error: 'Nur der Host kann die Einstellungen ändern.' });
      }
      if (room.state !== 'lobby') {
        return ack && ack({ error: 'Einstellungen können nur in der Lobby geändert werden.' });
      }
      room.settings = sanitizeSettings(settings, room.settings);
      broadcastState(room);
      ack && ack({ ok: true, settings: room.settings, poolSize: poolSizeFor(room.settings) });
    });

    socket.on('game:start', (_data, ack) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return;
      if (socket.data.clientId !== room.hostClientId) {
        return ack && ack({ error: 'Nur der Host kann das Spiel starten.' });
      }
      if (room.state !== 'lobby') return ack && ack({ error: 'Spiel läuft bereits.' });
      const res = startGame(room);
      ack && ack(res);
    });

    socket.on('game:stop', (_data, ack) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return;
      if (socket.data.clientId !== room.hostClientId) {
        return ack && ack({ error: 'Nur der Host kann das Spiel beenden.' });
      }
      endGame(room);
      ack && ack({ ok: true });
    });

    socket.on('guess', ({ text } = {}) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.state !== 'playing' || !room.current) return;
      const clientId = socket.data.clientId;
      if (room.answered.has(clientId)) return;
      if (room.current.mode !== 'type') return;

      const res = checkGuess(text, room.current.image.answers);
      if (res.correct) {
        recordCorrect(room, clientId);
        socket.emit('guess:result', { correct: true });
      } else {
        socket.emit('guess:result', {
          correct: false,
          closeness: closeness(text, room.current.image.answers),
        });
      }
    });

    socket.on('choice', ({ index } = {}) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.state !== 'playing' || !room.current) return;
      if (room.current.mode !== 'choice') return;
      const clientId = socket.data.clientId;
      if (room.answered.has(clientId)) return;

      const correct = Number(index) === room.current.correctIndex;
      if (correct) {
        recordCorrect(room, clientId);
        socket.emit('guess:result', { correct: true });
      } else {
        // Wrong choice locks the player out for this round (no second try).
        room.answered.set(clientId, { timeMs: null, gained: 0, wrong: true });
        socket.emit('guess:result', { correct: false, locked: true });
        io.to(room.code).emit('player:answered', { clientId, name: room.players.get(clientId)?.name });
        maybeEndEarly(room);
      }
    });

    function recordCorrect(room, clientId) {
      const c = room.current;
      const timeMs = Date.now() - c.startTime;
      const frac = Math.max(0, 1 - timeMs / (room.settings.roundTime * 1000));
      const rank = [...room.answered.values()].filter((a) => a.gained > 0).length;
      let gained = 50 + Math.round(150 * frac);
      if (rank === 0) gained += 25; // first-correct bonus
      room.answered.set(clientId, { timeMs, gained });
      const player = room.players.get(clientId);
      if (player) player.score += gained;
      io.to(room.code).emit('player:answered', { clientId, name: player?.name });
      broadcastState(room);
      maybeEndEarly(room);
    }

    socket.on('chat', ({ text } = {}) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return;
      const player = room.players.get(socket.data.clientId);
      if (!player) return;
      const clean = String(text || '').trim().slice(0, 300);
      if (!clean) return;
      io.to(room.code).emit('chat', { from: player.name, clientId: player.clientId, text: clean, ts: Date.now() });
    });

    socket.on('disconnect', () => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return;
      const player = room.players.get(socket.data.clientId);
      if (player && player.socketId === socket.id) {
        player.connected = false;
      }
      reassignHostIfNeeded(room);
      broadcastState(room);
      if (connectedCount(room) === 0) scheduleEmptyCleanup(room);
    });
  });
}

module.exports = { init, rooms };
