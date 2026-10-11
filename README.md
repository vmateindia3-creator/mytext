# WaveChat

A working, self-hostable messaging app — 1:1 chat, group chats, media sharing and WebRTC voice/video calls. Node.js + Socket.io backend, React Native (Expo) Android app.

> **What this is:** a complete, runnable MVP in the spirit of Telegram. Real-time messaging, accounts, groups, file/photo sharing and peer-to-peer calls all work. It is *not* a drop-in clone of Telegram's full feature set (no E2E encryption, no channels, no bots, no global CDN). See [Scope & limitations](#scope--limitations) for the honest picture.

---

## Features

- **Accounts** — register / login with JWT auth, bcrypt-hashed passwords.
- **1:1 chat** — real-time messages over Socket.io, online/last-seen presence.
- **Group chats** — create groups, add members, admin list.
- **Media sharing** — send photos and documents (25 MB limit per file).
- **Read receipts & typing indicators**.
- **Voice / video calls** — WebRTC with server-relayed signalling and STUN/TURN config.
- **Message history** — paginated, stored in MongoDB.

## Repository layout

```
wavechat/
├── server/            Node.js + Express + Socket.io API
│   ├── src/
│   │   ├── index.js        app entry (HTTP + sockets)
│   │   ├── config/db.js    Mongo connection
│   │   ├── models/         User, Conversation, Message
│   │   ├── middleware/     JWT auth
│   │   ├── routes/         auth, users, conversations, upload
│   │   ├── sockets/        real-time events + call signalling
│   │   └── utils/          message helpers, ICE servers
│   └── test/               unit + end-to-end smoke tests
├── app/               React Native (Expo) client
│   └── src/
│       ├── api/            REST client
│       ├── context/        auth + chat state
│       ├── screens/        login, chats, chat, new chat, group, call
│       ├── components/     avatar, message bubble
│       └── navigation/     stack navigator
├── docker-compose.yml  local MongoDB + server
└── render.yaml         one-click backend deploy on Render
```

---

## Quick start (local)

### 1. Backend

```bash
cd server
cp .env.example .env          # edit if needed
npm install
npm run dev                   # http://localhost:4000
```

You need a MongoDB. Either run the bundled Docker Compose from the repo root:

```bash
docker compose up -d mongo
```

…or point `MONGO_URI` in `server/.env` at a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

Verify the API:

```bash
npm run test:unit     # no database required
npm test              # full flow (needs a reachable MongoDB)
```

### 2. App

```bash
cd app
cp .env.example .env          # set EXPO_PUBLIC_API_URL
npm install
npx expo start
```

Scan the QR with **Expo Go** on Android, or press `a` to launch an emulator.

> **Important:** on a physical phone, `localhost` means the phone itself. Set `EXPO_PUBLIC_API_URL` to your computer's LAN IP (e.g. `http://192.168.1.20:4000`) and make sure both are on the same Wi-Fi.

---

## Deploy it for free (live, globally reachable)

### Backend → Render

1. Push this repo to GitHub.
2. Create a free **MongoDB Atlas** cluster (M0). Whitelist `0.0.0.0/0` and copy the connection string.
3. On [Render](https://render.com), choose **New → Blueprint** and point it at your repo. It reads `render.yaml`.
4. Set these environment variables when prompted:
   - `MONGO_URI` — your Atlas connection string
   - `PUBLIC_URL` — your Render URL, e.g. `https://wavechat-server.onrender.com`
   - `JWT_SECRET` is generated automatically.
5. Deploy. Your API is live at `https://wavechat-server.onrender.com/health`.

### App → an installable APK

```bash
cd app
npx eas build -p android --profile preview
```

EAS returns a download link for an `.apk` you can install on any Android phone. Set `EXPO_PUBLIC_API_URL` to your Render URL before building.

---

## Scope & limitations (read this)

Being upfront about what this MVP does and does not do:

- **Encryption:** messages are stored in plaintext in MongoDB. Telegram's headline feature is end-to-end encryption, which this does not implement. Do not use it for sensitive conversations as-is.
- **File storage:** uploads are written to the server's local disk. Render's free tier has an *ephemeral* filesystem, so uploaded media is **lost on every redeploy/restart**. For real use, switch the upload route to S3 / Cloudinary / Backblaze B2.
- **Calls:** work best 1:1 on good networks. For reliability behind strict/mobile NATs you must set `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` (a hosted TURN like Twilio, or a self-hosted `coturn`). Calls also require a **development build** of the app (`react-native-webrtc` is a native module and does not run in Expo Go).
- **Scale:** a single Node process. For large audiences you'd add a Redis adapter for Socket.io, horizontal scaling, and a CDN for media.
- **Not included:** channels, bots, message search, group calls, disappearing messages, push notifications (add `expo-notifications` + FCM).

These are all natural next steps — the codebase is structured so each can be added without a rewrite.

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

## License

MIT — see [LICENSE](./LICENSE).
