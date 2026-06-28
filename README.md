# 🍓 PicGuess

Ein Echtzeit-Multiplayer-Bilderratespiel im Stil von **PopSauce** (jklm.fun) —
aber mit **eigenen Bildern**: Du lädst deine Bilder hoch, sortierst sie in
Kategorien und stellst pro Spielrunde genau ein, welche Bilder vorkommen.

Spieler treten wie bei jklm.fun einfach mit **Nickname + 4-stelligem Raum-Code**
bei — keine Registrierung nötig.

## Features

- **Echtzeit-Multiplayer** über WebSockets (Socket.IO): privater Raum,
  4-stelliger Code zum Teilen, mehrere Spieler gleichzeitig.
- **Eigene Bilder hochladen** (auch mehrere auf einmal, Drag & Drop) und mit
  einer oder mehreren akzeptierten **Antworten** + **Kategorien** versehen.
- **Runden frei konfigurierbar** (nur der Host):
  - Anzahl Runden & Zeit pro Runde
  - Rate-Modus: **Namen tippen**, **Multiple Choice** oder **Gemischt**
  - Bilderauswahl **nach Kategorie** *oder* **Bild für Bild** an-/abwählen
    — genau steuern, welche Bilder rein- und welche rauskommen.
- **Tipp-Erkennung mit Toleranz**: kleine Tippfehler werden akzeptiert,
  Akzente/Groß-Kleinschreibung sind egal; während des Tippens zeigt ein Balken,
  wie „warm" du dran bist.
- **Punkte nach Geschwindigkeit** + Bonus für die erste richtige Antwort,
  Live-Rangliste, Rundenauflösung und Endergebnis.
- **Chat** im Raum.

## Schnellstart

Voraussetzung: **Node.js ≥ 22.5** (nutzt die eingebaute `node:sqlite`-DB,
keine native Kompilierung nötig).

```bash
npm install
npm start
```

Dann im Browser öffnen: <http://localhost:3000>

Optional anderer Port: `PORT=4000 npm start`

### Erste Schritte

1. Gehe auf **„Bilder verwalten"** und lege ein paar Kategorien an
   (z. B. *Tiere*, *Logos*, *Memes*).
2. Lade Bilder hoch, gib zu jedem die richtige(n) Antwort(en) an und hake die
   passenden Kategorien an.
3. Zurück auf der Startseite: Namen eingeben → **Neuen Raum erstellen**.
4. Teile den 4-stelligen Code mit deinen Freunden (sie geben ihn unter
   „Privatem Raum beitreten" ein).
5. Als Host Runden/Zeit/Modus und die Bilderauswahl einstellen → **Spiel starten**.

## So spielst du mit Freunden im selben Netzwerk

`npm start` lauscht auf allen Adressen. Andere im selben WLAN erreichen dich
über `http://<deine-lokale-IP>:3000`. Für Spiele übers Internet kannst du den
Port z. B. per Tunnel (ngrok/cloudflared) oder auf einem kleinen Server
freigeben.

## Projektstruktur

```
server/
  index.js     Express- + Socket.IO-Server (Einstiegspunkt)
  db.js        SQLite-Schema (node:sqlite)
  store.js     Datenzugriff: Kategorien, Bilder, Antworten, Spiel-Pool
  routes.js    REST-API: Upload & Verwaltung von Bildern/Kategorien
  matching.js  Antwort-Normalisierung + Tippfehler-Toleranz (Levenshtein)
  game.js      Räume, Runden-Logik, Punkte (die eigentliche Spiellogik)
public/
  index.html   Startseite (Raum erstellen/beitreten)
  room.html    Spielraum (Lobby-Konfiguration + Live-Spiel)
  manage.html  Bilder & Kategorien verwalten
  js/, css/    Frontend (Vanilla JS, kein Build-Schritt)
data/          SQLite-Datei (wird automatisch erzeugt, nicht eingecheckt)
uploads/       Hochgeladene Bilder (nicht eingecheckt)
```

## Hinweise

- Hochgeladene Bilder liegen unter `uploads/`, die Metadaten (Antworten,
  Kategorien) in `data/brgame.db`. Beide sind aus der Versionskontrolle
  ausgeschlossen — du fängst also mit einer leeren Sammlung an.
- Maximale Dateigröße pro Bild: 12 MB. Erlaubt: jpg, png, gif, webp, bmp, avif.
