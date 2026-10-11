const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Pluggable media storage.
 *
 * Set STORAGE_DRIVER to one of:
 *   local       (default) — saves to ./uploads on this server
 *   s3          — Amazon S3 / any S3-compatible bucket (Cloudflare R2, Backblaze B2, MinIO)
 *   cloudinary  — Cloudinary
 *
 * Every driver implements the same shape: putObject() returns a public URL and
 * a key. Optional cloud SDKs are required lazily, so the app runs fine with the
 * local driver and no extra dependencies installed.
 */

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

function driverName() {
  return (process.env.STORAGE_DRIVER || 'local').toLowerCase();
}

function randomKey(originalName) {
  const ext = path.extname(originalName || '').slice(0, 10);
  return `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${ext}`;
}

function publicUrlFor(key) {
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  return base ? `${base}/uploads/${key}` : `/uploads/${key}`;
}

// ---- local ----------------------------------------------------------------

async function putLocal({ buffer, filename }) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const key = randomKey(filename);
  await fs.promises.writeFile(path.join(UPLOAD_DIR, key), buffer);
  return { url: publicUrlFor(key), key };
}

// ---- s3 -------------------------------------------------------------------

async function putS3({ buffer, filename, mimetype }) {
  let S3Client, PutObjectCommand;
  try {
    // eslint-disable-next-line global-require
    ({ S3Client, PutObjectCommand } = require('@aws-sdk/client-s3'));
  } catch (err) {
    throw new Error('STORAGE_DRIVER=s3 requires "@aws-sdk/client-s3" (npm install it)');
  }

  const client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });

  const key = randomKey(filename);
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype || 'application/octet-stream',
      ACL: process.env.S3_ACL || undefined,
    })
  );

  const base =
    process.env.S3_PUBLIC_URL ||
    `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com`;
  return { url: `${base.replace(/\/$/, '')}/${key}`, key };
}

// ---- cloudinary -----------------------------------------------------------

async function putCloudinary({ buffer, filename }) {
  let cloudinary;
  try {
    // eslint-disable-next-line global-require
    cloudinary = require('cloudinary').v2;
  } catch (err) {
    throw new Error('STORAGE_DRIVER=cloudinary requires "cloudinary" (npm install it)');
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'mytext', resource_type: 'auto', public_id: path.parse(randomKey(filename)).name },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, key: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

// ---- public API -----------------------------------------------------------

const drivers = { local: putLocal, s3: putS3, cloudinary: putCloudinary };

/** True when the configured driver has everything it needs. */
function isConfigured() {
  const d = driverName();
  if (d === 'local') return true;
  if (d === 's3') return !!(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID);
  if (d === 'cloudinary') return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);
  return false;
}

/** Store a file and return { url, key }. */
async function putObject(file) {
  const driver = drivers[driverName()];
  if (!driver) throw new Error(`Unknown STORAGE_DRIVER: ${driverName()}`);
  return driver(file);
}

module.exports = { putObject, isConfigured, driverName, randomKey, UPLOAD_DIR };
