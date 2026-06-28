'use strict';

const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');

const apiRoutes = require('./routes');
const game = require('./game');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6 });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploaded images (cached aggressively; filenames are content-unique).
app.use(
  '/uploads',
  express.static(UPLOAD_DIR, {
    maxAge: '7d',
    setHeaders: (res) => res.set('Cache-Control', 'public, max-age=604800'),
  })
);

app.use('/api', apiRoutes);

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Static frontend.
app.use(express.static(PUBLIC_DIR));

game.init(io);

server.listen(PORT, () => {
  console.log(`\n  🍓 PicGuess läuft auf  http://localhost:${PORT}\n`);
  console.log('  Lokal spielen:   Browser öffnen → ' + `http://localhost:${PORT}`);
  console.log('  Mit Freunden übers Internet:  in einem ZWEITEN Fenster  "npm run tunnel"');
  console.log('  (zum Beenden dieses Fensters: Strg + C)\n');
});
