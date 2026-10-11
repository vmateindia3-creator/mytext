require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { connectDB } = require('./config/db');
const { initSockets } = require('./sockets');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const conversationRoutes = require('./routes/conversations');
const uploadRoutes = require('./routes/upload');

const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

function createApp() {
  const app = express();

  app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('tiny'));

  // Serve uploaded media.
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  // Health check (used by Render and uptime monitors).
  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/upload', uploadRoutes);

  app.use((_req, res) => res.status(404).json({ error: 'not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

async function start() {
  const app = createApp();
  const server = http.createServer(app);
  initSockets(server, CORS_ORIGIN);

  await connectDB(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mytext');

  server.listen(PORT, () => console.log(`[server] Mytext API listening on :${PORT}`));
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error('[server] failed to start:', err);
    process.exit(1);
  });
}

module.exports = { createApp, start };
