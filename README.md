# Mytext

A working, self-hostable messaging app — 1:1 chat, group chats, media sharing, end-to-end encrypted text and WebRTC voice/video calls.

- **App:** Flutter / Dart (Android, Play Store-ready)
- **Backend:** Node.js + Express + Socket.io + MongoDB

> **What this is:** a complete, runnable MVP in the spirit of WhatsApp / Telegram. Accounts, real-time messaging, groups, photo & file sharing, E2E-encrypted text and peer-to-peer calls all work. It is *not* a drop-in clone of their full feature set — read [Scope & limitations](#scope--limitations) before trusting it with anything sensitive.

---

## Features

- **Accounts** — sign up and sign in with a **phone number + SMS one-time code**. Username/password is still available for accounts that prefer it.
- **1:1 chat** — real-time messages over Socket.io, online/last-seen presence. Start a chat by typing someone's **phone number**.
- **Group chats** — create groups, add members, admin list.
- **Media sharing** — photos and documents (25 MB limit), on local disk, S3 or Cloudinary.
- **End-to-end encrypted text** — X25519 + HKDF + AES-256-GCM; the server only stores ciphertext.
- **Push notifications** — Firebase Cloud Messaging, sent to members who are offline.
- **Read receipts & typing indicators**.
- **Voice & video calls** — 1:1 WebRTC calls over the internet, with an incoming-call screen so people can call *you* too.
- **Automatic APK builds** — GitHub Actions builds an installable APK for you.

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
│   │   ├── services/            API, Socket.io, storage, crypto, keys
│   │   ├── providers/           auth + chat state (Provider)
│   │   ├── screens/             login, home, chat, group, profile, call
│   │   └── widgets/             avatar, message bubble, chat tile
│   ├── android/                 Play Store-ready Android config
│   └── test/                    unit tests (incl. crypto)
├── server/                  Node.js + Socket.io backend
│   ├── src/
│   │   ├── models/              User, Conversation, Message
│   │   ├── routes/              auth, users, conversations, upload
│   │   ├── sockets/             real-time events, push, call signalling
│   │   └── utils/               storage drivers, push, ICE, message helpers
│   └── test/                    unit + end-to-end tests
├── .github/workflows/       CI + automatic APK build
├── docker-compose.yml       local MongoDB + server
└── render.yaml              one-click backend deploy on Render
```

---

## Get the APK (no tools to install)

The repo builds an APK for you on every push to `app/`:

1. Open the **Actions** tab on GitHub.
2. Pick the latest **Build APK** run.
3. Download the **mytext-apk** artifact → install `app-release.apk` on any Android phone.

You can also start a build by hand: **Actions → Build APK → Run workflow**.

> Before building for real use, set `AppConfig.apiUrl` in `app/lib/config.dart` to your deployed backend URL and push — the workflow will rebuild with it baked in.

**Building locally instead** (needs Flutter + Android SDK):

```bash
cd app
flutter pub get
flutter build apk --release        # build/app/outputs/flutter-apk/app-release.apk
flutter build appbundle --release  # for Google Play
```

---

## Phone login (OTP)

Signing up needs only a phone number:

1. The app asks the server to send a code (`POST /api/auth/request-otp`).
2. The server stores a **hash** of the code (never the code itself) with a 5-minute expiry and a 30-second resend throttle.
3. The app checks it (`POST /api/auth/verify-otp`). On success the account is created if it is new, and the app receives a normal login token.

### Sending real SMS

Pick a provider with `SMS_DRIVER` in `server/.env`:

| Driver | Vars |
| --- | --- |
| `console` (default) | none — **no SMS is sent**. The code is printed in the server log *and* returned to the app so you can test the whole flow for free. |
| `twilio` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| `msg91` | `MSG91_AUTH_KEY`, `MSG91_SENDER_ID`, `MSG91_TEMPLATE_ID` |
| `fast2sms` | `FAST2SMS_API_KEY` |

> **Important:** while `SMS_DRIVER=console`, the API returns the code in its response (`devCode`) and the app shows it on the OTP screen. That is for testing only. Once a real provider is configured, set `OTP_DEV_MODE=false` so the code is never returned over the network.

To chat with someone, you need their phone number — they must already have the app installed and signed in. Type the number under **New chat → Find**.

---

## Quick start

### 1. Backend

```bash
cd server
cp .env.example .env       # edit if needed
npm install
npm run dev                # http://localhost:4000
```

MongoDB: use the bundled Docker service (`docker compose up -d mongo`) or set `MONGO_URI` to a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

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

Set `AppConfig.apiUrl` in `app/lib/config.dart`:

- **Android emulator:** `http://10.0.2.2:4000` (already the default)
- **Real phone:** your computer's LAN IP, e.g. `http://192.168.1.20:4000`

---

## End-to-end encryption

Text messages are encrypted on the device before they are sent, so the server never sees their contents.

**How it works**

1. On first sign-in each device generates an **X25519** key pair. The public key is uploaded; the private key is stored in the platform keystore and never leaves the device.
2. To send, the app derives a shared secret with each member (**X25519** + **HKDF-SHA256**) and encrypts the text for each of them with **AES-256-GCM**.
3. The server stores only `{ ciphertext, nonce, mac, per-recipient boxes }` — it cannot read any of it.
4. To read, a member derives the same shared secret with the sender's public key and opens their own box.

The crypto lives in `app/lib/services/crypto_service.dart` (pure Dart, so it is unit-tested on its own — see `app/test/crypto_test.dart`).

**What this does *not* give you**

- It is **not audited**. Do not treat it as WhatsApp-grade.
- **No forward secrecy.** Keys are static, so a leaked private key exposes past messages. There is no double-ratchet.
- **Media files are not encrypted.** Photos and documents are uploaded to storage and referenced by URL; only text is end-to-end encrypted.
- **Metadata is visible** to the server: who talks to whom, and when.
- If a member has not published a key yet, that message **falls back to plaintext** so the chat keeps working.

---

## Media storage

Choose a driver with `STORAGE_DRIVER` in `server/.env`:

| Driver | What it does | Required vars |
| --- | --- | --- |
| `local` (default) | Saves to `server/uploads` | — |
| `s3` | Amazon S3 / Cloudflare R2 / Backblaze B2 / MinIO | `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (+ optional `S3_ENDPOINT`, `S3_PUBLIC_URL`) |
| `cloudinary` | Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |

The cloud SDKs are optional dependencies; install the one you use:

```bash
npm install @aws-sdk/client-s3      # for s3
npm install cloudinary              # for cloudinary
```

> **Important:** with `local`, uploads live on the server's disk. Render's free tier is ephemeral, so files are lost on redeploy. Use `s3` or `cloudinary` in production.

---

## Voice & video calls

Open any 1:1 chat and tap the **📞** (voice) or **📹** (video) button in the top bar. The other person gets a full-screen ringing screen with **Accept / Decline** — they can be on any screen in the app at the time.

You can call anyone who has a Mytext account: start a chat with their phone number (see above), then tap the call button.

**How it connects.** The two phones talk directly to each other over WebRTC. The server only relays the handshake (offer / answer / ICE candidates); it never carries the audio or video.

### Making calls work reliably

WebRTC needs help getting through mobile networks. The server decides what to hand the app:

| Situation | What is used |
| --- | --- |
| You set `TURN_URL` (+ username/credential) | **Your own TURN server** — the right answer for production. |
| You don't | Public **STUN** plus a **free public TURN relay**, so calls have a good chance of connecting out of the box. |
| `PUBLIC_TURN_ENABLED=false` | Public STUN only. Calls will fail on many mobile networks. |

The free relay is shared with the whole internet and is rate-limited — treat it as a testing crutch. For anything real, run your own [`coturn`](https://github.com/coturn/coturn) or use Twilio's Network Traversal Service and set `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL`.

### Honest limits

- **Incoming calls ring only while the app is running.** The app listens for calls over its live socket connection. If it has been fully closed, nothing wakes it — that needs push notifications with a full-screen call notification (the backend FCM wiring is in place, but it is not finished on the device side).
- **Group calls are not supported** — calls are always 1:1.
- Calls need the microphone (and camera for video). The permissions are already declared in `AndroidManifest.xml`.

---

## Push notifications

The backend can send Firebase Cloud Messaging notifications to members who are offline. It is dependency-free (it signs its own OAuth token) and is a **silent no-op** when unconfigured.

**Enable it**

1. Create a Firebase project and download a service-account JSON.
2. On the server set either `FIREBASE_SERVICE_ACCOUNT` (the JSON as a string) or `FIREBASE_SERVICE_ACCOUNT_PATH`.
3. On the device, add `firebase_messaging` to the app and register the token:
   ```dart
   final token = await FirebaseMessaging.instance.getToken();
   if (token != null) await api.registerDevice(token);
   ```
   This needs your `google-services.json` and the Google Services Gradle plugin.

> `firebase_messaging` is intentionally **not** in `pubspec.yaml` by default: adding it without a Firebase config makes the Android build fail. The backend side (`POST /api/users/me/devices`, the `pushTokens` field, and offline delivery in the socket layer) is already wired and tested.

---

## Publishing to Google Play

| Setting | Value |
| --- | --- |
| Application ID | `com.mytext.app` |
| App name (label) | `Mytext` |
| Version | `1.0.0+1` (`pubspec.yaml`) |
| Icon | all densities + `assets/icon/play_store_512.png` |
| Permissions | INTERNET, CAMERA, RECORD_AUDIO, media read |

```bash
cd app
flutter build appbundle --release
```

The default release build is signed with the debug key (fine for testing). For the Play Store, create a keystore, add `app/android/key.properties`, and point the `release` signing config at it — then upload the `.aab` in the [Play Console](https://play.google.com/console).

> Play will ask you to justify CAMERA / RECORD_AUDIO (used only for in-app calls and photo sharing). Fill in the Data Safety form accordingly. If you drop calls, remove them from `AndroidManifest.xml`.

---

## Deploy the backend on Render (free)

1. Push this repo to GitHub.
2. Create a free **MongoDB Atlas** M0 cluster → *Network Access* → allow `0.0.0.0/0` → copy the connection string.
3. On [Render](https://render.com): **New → Blueprint**, pick this repo. Render reads `render.yaml` and asks for the values marked *sync: false*.
4. Fill in `MONGO_URI` (the Atlas string) and `PUBLIC_URL` (your Render URL, e.g. `https://mytext-server.onrender.com`). `JWT_SECRET` is generated for you.
5. Deploy, then open `https://<your-app>.onrender.com/health`.
6. Build the app against that URL: **Actions → Build APK → Run workflow**, paste the URL, download the APK.

### Make it permanent

Two things decide whether your data survives:

| What | Where it lives | Permanent? |
| --- | --- | --- |
| **Messages, accounts, groups** | MongoDB (the `MONGO_URI` you set) | ✅ **Yes**, if you use **MongoDB Atlas** — it is a real managed database. |
| **Photos & files** | The `STORAGE_DRIVER` you chose | ❌ **No** with `local` — Render's free disk is wiped on every restart. ✅ **Yes** with `cloudinary` or `s3`. |

So for permanent photos, set in Render:

```
STORAGE_DRIVER = cloudinary
CLOUDINARY_CLOUD_NAME = ...
CLOUDINARY_API_KEY    = ...
CLOUDINARY_API_SECRET = ...
```

[Cloudinary](https://cloudinary.com) has a free tier (25 GB) and is the quickest to set up. Cloudflare R2 / Backblaze B2 work too — use `STORAGE_DRIVER=s3` with the `S3_*` variables.

**Confirm it worked:** open `/health`. You want to see

```json
{ "database": "connected", "storage": "cloudinary", "storagePermanent": true }
```

### One honest catch: Render's free tier sleeps

A free Render web service **spins down after ~15 minutes of no traffic**, and the next request takes ~30–50 seconds to wake it up. In practice that means the *first* message after a quiet spell is slow, then everything is instant. If that bothers you, either upgrade that one service to a paid instance (a few dollars a month), or ping `/health` every 10 minutes from a free uptime monitor (e.g. UptimeRobot) to keep it awake.

---

## API reference (short)

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/request-otp` | Send an SMS code to a phone number |
| `POST` | `/api/auth/verify-otp` | Check the code → `{ token, user }` |
| `POST` | `/api/auth/register` | Create account with username/password |
| `POST` | `/api/auth/login` | Sign in with username/password |
| `GET` | `/api/users/me` | Current profile |
| `GET` | `/api/users?q=` | Search people (name, username or phone) |
| `GET` | `/api/users/lookup?phone=` | Find the account for a phone number |
| `GET` | `/api/users/keys?ids=` | Public encryption keys |
| `POST` | `/api/users/me/public-key` | Publish encryption public key |
| `POST` | `/api/users/me/devices` | Register a push token |
| `DELETE` | `/api/users/me/devices` | Remove a push token |
| `GET` | `/api/conversations` | List my chats |
| `POST` | `/api/conversations` | Create direct/group chat |
| `GET` | `/api/conversations/:id/messages` | Message history |
| `POST` | `/api/upload` | Upload a file (multipart) |
| `GET` | `/health` | Health check |

**Socket.io events:** `message:send` (accepts an `enc` payload), `message:new`, `message:read`, `typing`, `presence`, `conversation:join/leave/updated`, and call signalling `call:invite`, `call:offer`, `call:answer`, `call:ice`, `call:end`, `call:reject`.

---

## Scope & limitations

- **Encryption:** text is end-to-end encrypted (see above), but the scheme is unaudited, has no forward secrecy, does not cover media files, and leaks metadata. Don't treat it as WhatsApp-grade.
- **Calls:** `flutter_webrtc` works best 1:1 on good networks. Behind strict/mobile NATs you need a **TURN** server — set `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL`.
- **Scale:** a single Node process. For large audiences, add the Socket.io Redis adapter, horizontal scaling and a media CDN.
- **Not included:** channels, bots, message search, group calls, disappearing messages.

Each of these can be added without a rewrite.

---

## License

MIT — see [LICENSE](./LICENSE).
