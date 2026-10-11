# Mytext

A working, self-hostable messaging app — 1:1 chat, group chats, media sharing and WebRTC voice/video calls.

- **App:** Flutter / Dart (Android, Play Store-ready)
- **Backend:** Node.js + Express + Socket.io + MongoDB

> **What this is:** a complete, runnable MVP in the spirit of WhatsApp / Telegram. Accounts, real-time messaging, groups, photo & file sharing and peer-to-peer calls all work. It is *not* a drop-in clone of their full feature set (no end-to-end encryption, no channels, no bots). See [Scope & limitations](#scope--limitations).

---

## Why Flutter?

The Android app is written in **Flutter (Dart)** — one clean codebase, a native-feeling UI, and a straightforward path to Google Play. The code is deliberately simple and readable: small files, clear names, one job per class.

## Repository layout

```
mytext/
├── app/                     Flutter (Dart) Android app
│   ├── lib/
│   │   ├── main.dart            entry point
│   │   ├── app.dart             providers + auth gate
│   │   ├── config.dart          API URL + app name
│   │   ├── theme.dart           colours & styles
│   │   ├── models/              User, Message, Conversation
│   │   ├── services/            API, Socket.io, local storage
│   │   ├── providers/           auth + chat state (Provider)
│   │   ├── screens/             login, home, chat, group, profile, call
│   │   └── widgets/             avatar, message bubble, chat tile
│   ├── android/                 Play Store-ready Android config
│   ├── assets/icon/             Play Store 512×512 icon
│   └── test/                    unit tests
├── server/                  Node.js + Socket.io backend
│   └── src/                     models, routes, sockets, utils
├── docker-compose.yml       local MongoDB + server
└── render.yaml              one-click backend deploy on Render
```

---

## Quick start

### 1. Backend

```bash
cd server
cp .env.example .env       # edit if needed
npm install
npm run dev                # http://localhost:4000
```

You need MongoDB. Easiest is the bundled Docker service from the repo root:

```bash
docker compose up -d mongo
```

…or set `MONGO_URI` in `server/.env` to a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

Check it works:

```bash
npm run test:unit    # no database needed
npm test             # full flow (needs MongoDB)
```

### 2. App

```bash
cd app
flutter pub get
flutter run
```

Before running, open `app/lib/config.dart` and set `AppConfig.apiUrl`:

- **Android emulator:** `http://10.0.2.2:4000` (already the default)
- **Real phone:** your computer's LAN IP, e.g. `http://192.168.1.20:4000`

> If `flutter run` complains about missing platform files, run `flutter create .` once inside `app/` — it regenerates any missing Android scaffolding without touching your Dart code.

---

## Publishing to Google Play

The project is already set up for it:

| Setting | Value |
| --- | --- |
| Application ID | `com.mytext.app` |
| App name (label) | `Mytext` |
| Version | `1.0.0+1` (`pubspec.yaml`) |
| Icon | generated for all densities + `assets/icon/play_store_512.png` |
| Permissions | only INTERNET, CAMERA, RECORD_AUDIO, media read |

**Build a release bundle:**

```bash
cd app
flutter build appbundle --release     # produces build/app/outputs/bundle/release/app-release.apk.aab
```

**Sign it properly** (the default build uses the debug key — fine for testing, not for the Play Store):

1. Create a keystore:
   ```bash
   keytool -genkey -v -keystore ~/mytext-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
2. Create `app/android/key.properties`:
   ```
   storePassword=YOUR_PASSWORD
   keyPassword=YOUR_PASSWORD
   keyAlias=upload
   storeFile=/absolute/path/to/mytext-upload.jks
   ```
3. In `app/android/app/build.gradle`, load those properties and point the `release` signing config at them (a two-line change — swap `signingConfigs.debug` for `signingConfigs.release`).

Then upload the `.aab` in the [Google Play Console](https://play.google.com/console). You'll also need a store listing (screenshots, description, privacy policy URL).

> **Note on permissions:** Play may ask you to justify CAMERA / RECORD_AUDIO. They are used only for in-app voice/video calls and photo sharing — mention that in the Data Safety form. If you drop calls, you can remove them from `AndroidManifest.xml` and reduce review friction.

---

## Deploy the backend (free)

1. Push this repo to GitHub.
2. Create a free **MongoDB Atlas** M0 cluster; whitelist `0.0.0.0/0`; copy the connection string.
3. On [Render](https://render.com): **New → Blueprint**, point at your repo. It reads `render.yaml`.
4. Set `MONGO_URI` (Atlas string) and `PUBLIC_URL` (your Render URL, e.g. `https://mytext-server.onrender.com`). `JWT_SECRET` is generated automatically.
5. Deploy → API live at `https://mytext-server.onrender.com/health`.
6. Point `AppConfig.apiUrl` in the app at that URL, then rebuild.

---

## API reference (short)

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create account → `{ token, user }` |
| `POST` | `/api/auth/login` | Sign in → `{ token, user }` |
| `GET` | `/api/users/me` | Current profile |
| `GET` | `/api/users?q=` | Search people |
| `GET` | `/api/conversations` | List my chats |
| `POST` | `/api/conversations` | Create direct/group chat |
| `GET` | `/api/conversations/:id/messages` | Message history |
| `POST` | `/api/upload` | Upload a file (multipart) |
| `GET` | `/health` | Health check |

**Socket.io events:** `message:send`, `message:new`, `message:read`, `typing`, `presence`, `conversation:join/leave/updated`, and call signalling `call:invite`, `call:offer`, `call:answer`, `call:ice`, `call:end`, `call:reject`.

---

## Scope & limitations (read this)

- **Encryption:** messages are stored in plaintext in MongoDB. End-to-end encryption is *not* implemented. Don't use it for sensitive conversations as-is.
- **File storage:** uploads go to the server's local disk. Render's free tier is ephemeral, so media is **lost on redeploy/restart**. For production, switch `server/src/routes/upload.js` to S3 / Cloudinary / Backblaze B2.
- **Calls:** `flutter_webrtc` works best 1:1 on good networks. Behind strict/mobile NATs you need a **TURN** server — set `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` in the backend env (hosted Twilio TURN, or self-hosted `coturn`).
- **Scale:** a single Node process. For large audiences, add the Socket.io Redis adapter, horizontal scaling and a media CDN.
- **Not included:** channels, bots, message search, group calls, disappearing messages, push notifications (add `firebase_messaging`).

Each of these can be added without a rewrite.

---

## License

MIT — see [LICENSE](./LICENSE).
