const mongoose = require('mongoose');

/**
 * Connect to MongoDB. Retries a few times so a cold database on a free host
 * (Render + Atlas) has time to wake up.
 */
async function connectDB(uri, { retries = 5, delayMs = 3000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
      console.log('[db] connected to MongoDB');
      return mongoose.connection;
    } catch (err) {
      console.error(`[db] connection attempt ${attempt} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

module.exports = { connectDB };
