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

## Mit Freunden spielen

### Im selben WLAN

`npm start` lauscht auf allen Adressen. Andere im selben Netzwerk erreichen dich
über `http://<deine-lokale-IP>:3000` (lokale IP unter Windows mit `ipconfig`,
Feld „IPv4-Adresse"). Ggf. muss Node einmalig durch die Windows-Firewall
erlaubt werden (Abfrage beim ersten Start mit „Zugriff zulassen" bestätigen).

### Übers Internet (Cloudflare-Tunnel, kostenlos, ohne Account)

1. `npm start` laufen lassen (Server auf Port 3000).
2. [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
   installieren — unter Windows am einfachsten:
   ```cmd
   winget install --id Cloudflare.cloudflared
   ```
   Danach das Terminal neu öffnen.
3. In einem **zweiten** Fenster den Tunnel starten:
   ```cmd
   npm run tunnel
   ```
   (entspricht `cloudflared tunnel --url http://localhost:3000`)
4. cloudflared zeigt eine öffentliche Adresse wie
   `https://zufällige-wörter.trycloudflare.com` an — diese URL teilst du mit
   deinen Freunden. Sie öffnen sie im Browser, geben Namen + Raum-Code ein.

Die Tunnel-Adresse ist temporär und ändert sich bei jedem Neustart von
cloudflared. **Hinweis:** Wer die URL hat, erreicht auch die Seite „Bilder
verwalten" — teile sie also nur mit Leuten, denen du vertraust, und beende den
Tunnel (Strg + C) nach dem Spielen.

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
