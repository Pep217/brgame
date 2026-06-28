// Landing page: set nickname, create or join a room, then redirect to room.html.

const nickInput = document.getElementById('nick');
const codeInput = document.getElementById('code');
const errEl = document.getElementById('err');

nickInput.value = getNick();
nickInput.addEventListener('input', () => setNick(nickInput.value.trim()));
codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '');
});

const socket = io();

function requireNick() {
  const name = nickInput.value.trim();
  if (!name) {
    errEl.textContent = 'Bitte gib zuerst einen Namen ein.';
    nickInput.focus();
    return null;
  }
  setNick(name);
  errEl.textContent = '';
  return name;
}

document.getElementById('create').addEventListener('click', () => {
  const name = requireNick();
  if (!name) return;
  socket.emit('room:create', { name, clientId: getClientId() }, (res) => {
    if (res && res.code) {
      location.href = '/room.html?code=' + res.code;
    } else {
      errEl.textContent = (res && res.error) || 'Konnte Raum nicht erstellen.';
    }
  });
});

function doJoin() {
  const name = requireNick();
  if (!name) return;
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== 4) {
    errEl.textContent = 'Bitte einen 4-stelligen Code eingeben.';
    return;
  }
  socket.emit('room:join', { code, name, clientId: getClientId() }, (res) => {
    if (res && res.code) {
      location.href = '/room.html?code=' + res.code;
    } else {
      errEl.textContent = (res && res.error) || 'Beitritt fehlgeschlagen.';
    }
  });
}

document.getElementById('join').addEventListener('click', doJoin);
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
nickInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('create').click();
});
