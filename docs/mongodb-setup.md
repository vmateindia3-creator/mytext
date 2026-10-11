# MongoDB Atlas setup (free) — the database for Mytext

This is where **all your text data lives**: accounts, phone numbers, conversations,
messages, groups, device tokens and public keys. It is a real managed database, so
your chats survive restarts, redeploys and months of time.

> **Photos and files are not stored here.** They go to Cloudinary (or S3) — see the
> "Make it permanent" section of the main README. MongoDB only holds text, which is
> tiny: 100,000 messages is roughly 20 MB.

You need one thing at the end: a **connection string** that you paste into Render as
`MONGO_URI`.

---

## 1. Create a free account

1. Go to <https://www.mongodb.com/cloud/atlas/register>.
2. Sign up with Google or an email address. No card is needed — the free tier is
   free forever.

## 2. Create the cluster

1. Atlas asks you to **deploy a cluster**. Choose **M0 / Free**.
2. Under **Provider & Region**, pick a region close to your users. For India,
   **AWS / Mumbai (ap-south-1)** gives the lowest delay. Any region works.
3. Give it a name (e.g. `mytext`) and click **Create Deployment**.

The cluster takes 1–3 minutes to build.

## 3. Create a database user

Atlas will show a **Security Quickstart** step. If you miss it, open
**Security → Database Access**.

1. Click **Add New Database User**.
2. **Authentication Method:** Password.
3. **Username:** e.g. `mytextadmin`
4. **Password:** click **Autogenerate Secure Password** and copy it somewhere safe.

   > Use only letters and numbers if you can. If your password contains `@ : / ? # [ ] %`,
   > you must URL-encode it later (see step 5) or the connection will fail.

5. **Database User Privileges:** *Read and write to any database*.
6. Click **Add User**.

## 4. Allow connections from your server

Same **Security Quickstart**, or **Security → Network Access**.

1. Click **Add IP Address**.
2. Choose **Allow Access from Anywhere** → this fills in `0.0.0.0/0`.
3. Confirm.

> Render's free tier does not have a fixed outgoing IP, so `0.0.0.0/0` is the practical
> choice. It means "any server may try to connect" — your username and password are
> still required, so this is normal for small apps. If you later move to a paid Render
> instance with a static IP, narrow this to that single IP.

## 5. Copy the connection string

1. Go to **Database → Clusters → Connect**.
2. Choose **Drivers** (not "Compass", not "Shell").
3. Driver: **Node.js**, Version: **6.x or later**.
4. Copy the string. It looks like:

   ```
   mongodb+srv://mytextadmin:<db_password>@mytext.abcde.mongodb.net/?retryWrites=true&w=majority&appName=mytext
   ```

5. Now edit it in two ways:

   **a) Put your real password in.** Replace `<db_password>` with the password from
   step 3. If it contains any of `@ : / ? # [ ] %`, replace each one with its
   percent-encoded form (`@` → `%40`, `:` → `%3A`, `/` → `%2F`, `?` → `%3F`,
   `#` → `%23`, `%` → `%25`).

   **b) Add the database name.** Insert `/mytext` right after `.net`, before the `?`:

   ```
   mongodb+srv://mytextadmin:MyPassword123@mytext.abcde.mongodb.net/mytext?retryWrites=true&w=majority&appName=mytext
   ```

   > Without `/mytext` your data is written to a database called `test`. It still works,
   > but it is confusing later. Do not skip this.

That finished string is your `MONGO_URI`.

## 6. Put it into Render

1. Open your Render service → **Environment**.
2. Add (or edit) the variable:

   ```
   MONGO_URI = mongodb+srv://mytextadmin:MyPassword123@mytext.abcde.mongodb.net/mytext?retryWrites=true&w=majority
   ```

3. **Save** — Render redeploys automatically.

## 7. Check it worked

Open `https://<your-app>.onrender.com/health` in a browser. You want:

```json
{
  "status": "ok",
  "database": "connected",
  ...
}
```

If it says `"database": "disconnected"`, the server could not reach Atlas — see below.

Then test for real: send a message, restart the Render service
(**Manual Deploy → Restart**), and open the chat again. The message should still be
there.

---

## Common errors and what they mean

| What you see | Cause | Fix |
| --- | --- | --- |
| `bad auth : authentication failed` | Wrong username or password, or the password was not URL-encoded | Re-check step 3 and step 5a |
| `Could not connect to any servers` / timeouts | The server's IP is not allowed | Re-check step 4 (`0.0.0.0/0`) |
| `MongooseError: The \`uri\` parameter ... must be a string` | `MONGO_URI` is empty in Render | Set it in Environment |
| `Invalid scheme, expected connection string to start with "mongodb://" or "mongodb+srv://"` | Extra spaces or quotes pasted in | Paste the raw string, no quotes |
| Everything works but data appears under a `test` database | The `/mytext` part is missing | Add it (step 5b) |
| `querySrv ENOTFOUND _mongodb._tcp...` | Typo in the cluster hostname, or no internet/DNS on the host | Copy the string again from Atlas |

---

## Free-tier facts worth knowing

- **512 MB storage** on M0. That is a very large number of text messages. Media never
  lands here.
- **No card required**, and it does not expire after 30 days (unlike some other free
  hosts).
- If a free cluster sits completely unused for a long time, Atlas may pause it. If your
  app suddenly cannot connect, open the Atlas dashboard and click **Resume**.
- Backups are not included on the free tier. For anything important, take an occasional
  export from **Database → Clusters → ... → Export**.

---

## Quick recap

1. Register at MongoDB Atlas.
2. Create an **M0 free** cluster (region: Mumbai for India).
3. Create a database user (remember the password).
4. Network Access → **Allow access from anywhere**.
5. **Connect → Drivers → Node.js** → copy the string.
6. Replace `<db_password>` with the real password, and insert **`/mytext`** before the `?`.
7. Paste it into Render as `MONGO_URI`.
8. Open `/health` and confirm `"database": "connected"`.
