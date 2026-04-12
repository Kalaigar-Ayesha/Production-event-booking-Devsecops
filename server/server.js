const dns = require('dns');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load repo-root .env first, then server/.env (override: true so server/.env wins over root).
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

const mongoUri =
  (process.env.MONGO_URI && String(process.env.MONGO_URI).trim()) ||
  'mongodb://127.0.0.1:27017/eventora';

// Atlas mongodb+srv uses SRV DNS (_mongodb._tcp...). Some Windows/resolver setups return
// querySrv ECONNREFUSED; using public DNS for this Node process fixes many of those cases.
const useAtlasSrv = mongoUri.startsWith('mongodb+srv://');
if (useAtlasSrv && process.env.USE_SYSTEM_DNS !== '1') {
  if (process.env.DNS_SERVERS) {
    dns.setServers(
      process.env.DNS_SERVERS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
  } else {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
}

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const bookingRoutes = require('./routes/bookings');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);

// Database Connection (serverSelectionTimeoutMS surfaces failures faster in logs)
mongoose
  .connect(mongoUri, { serverSelectionTimeoutMS: 20000 })
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => {
    console.error('MongoDB Connection Error:', err);
    if (String(err.message || err).includes('querySrv')) {
      console.error(
        'Atlas SRV DNS still failing. Options: (1) Atlas → Network Access → allow your IP. (2) Set DNS_SERVERS in server/.env (comma list). (3) Atlas → Connect → standard mongodb://… string (no +srv) if offered. (4) USE_SYSTEM_DNS=1 to skip this app’s DNS override.'
      );
    }
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
