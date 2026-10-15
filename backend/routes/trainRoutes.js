const express = require('express');
const router = express.Router();
const Train = require('../models/Train');
const User = require('../models/User');

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');

// GET /api/trains/search-users — officer searches registered passenger accounts
router.get('/search-users', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json([]);
    }
    const regex = new RegExp(q, 'i');
    const users = await User.find({
      role: 'passenger',
      $or: [{ name: regex }, { phone: regex }, { email: regex }]
    }).select('name email phone').limit(10).lean();
    res.json(users);
  } catch (err) {
    console.error('User search error:', err.message);
    res.status(500).json({ message: 'Error searching users.' });
  }
});


// Initial seed data for Indian Railways trains
const INITIAL_TRAINS = [
  { trainNumber: '12951', trainName: '12951 — Mumbai Rajdhani Express', origin: 'NDLS - New Delhi', destination: 'MMCT - Mumbai Central', currentStation: 'Ratlam Jn (RTM)', delayMinutes: 5 },
  { trainNumber: '12952', trainName: '12952 — August Kranti Rajdhani', origin: 'MMCT - Mumbai Central', destination: 'NDLS - New Delhi', currentStation: 'Kota Jn (KOTA)', delayMinutes: 0 },
  { trainNumber: '12626', trainName: '12626 — Kerala Superfast Express', origin: 'NDLS - New Delhi', destination: 'TVC - Thiruvananthapuram', currentStation: 'Bhopal Jn (BPL)', delayMinutes: 12 },
  { trainNumber: '12002', trainName: '12002 — New Delhi Shatabdi', origin: 'NDLS - New Delhi', destination: 'RKB - Rani Kamlapati', currentStation: 'Agra Cantt (AGC)', delayMinutes: 2 },
  { trainNumber: '22436', trainName: '22436 — Vande Bharat Express', origin: 'NDLS - New Delhi', destination: 'BSB - Varanasi', currentStation: 'Kanpur Central (CNB)', delayMinutes: 0 },
  { trainNumber: '12301', trainName: '12301 — Howrah Rajdhani Express', origin: 'HWH - Howrah', destination: 'NDLS - New Delhi', currentStation: 'Dhanbad Jn (DHN)', delayMinutes: 8 },
  { trainNumber: '12622', trainName: '12622 — Tamil Nadu Express', origin: 'NDLS - New Delhi', destination: 'MAS - Chennai Central', currentStation: 'Nagpur (NGP)', delayMinutes: 15 },
  { trainNumber: '12260', trainName: '12260 — Sealdah Duronto Express', origin: 'NDLS - New Delhi', destination: 'SDAH - Sealdah', currentStation: 'Asansol Jn (ASN)', delayMinutes: 0 }
];

// Helper: Sync/Seed trains database
async function seedTrainsIfEmpty() {
  try {
    const count = await Train.countDocuments();
    if (count === 0) {
      await Train.insertMany(INITIAL_TRAINS);
      console.log('✅ [TRAIN API] Initialized Train database with 8 real Indian Railways trains');
    }
  } catch (err) {
    console.warn('⚠️ [TRAIN API] Train seeding notice:', err.message);
  }
}

// Update telemetry for all trains from Python API (every 2 hours or on-demand)
async function updateAllTrainTelemetry() {
  try {
    const trains = await Train.find();
    console.log(`⏰ [TRAIN API REFRESH] Auto-refreshing 2-hour telemetry for ${trains.length} trains...`);
    for (const t of trains) {
      try {
        const pyRes = await fetch(`${ML_SERVICE_URL}/verify-evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: '', trainNumber: t.trainNumber, coach: 'B1' })
        });
        if (pyRes.ok) {
          const data = await pyRes.json();
          if (data.train_position) {
            t.lastTelemetryUpdate = new Date();
            if (data.train_position.latitude && data.train_position.longitude) {
              t.currentStation = `Lat: ${data.train_position.latitude.toFixed(2)}, Lng: ${data.train_position.longitude.toFixed(2)} (${data.train_position.source || 'Live NTES'})`;
            }
            await t.save();
          }
        }
      } catch (e) {
        // Ignore individual train fetch errors
      }
    }
    console.log('✅ [TRAIN API REFRESH] 2-Hour Telemetry update completed successfully.');
  } catch (err) {
    console.warn('⚠️ Train telemetry refresh error:', err.message);
  }
}

// Run 2-hour periodic telemetry refresh timer (2 * 60 * 60 * 1000 ms)
setInterval(updateAllTrainTelemetry, 2 * 60 * 60 * 1000);

// GET /api/trains - List all trains with passenger manifest details
router.get('/', async (req, res) => {
  try {
    await seedTrainsIfEmpty();
    const trains = await Train.find().sort({ trainNumber: 1 });
    res.json(trains);
  } catch (err) {
    console.error('Error fetching trains list:', err);
    res.status(500).json({ message: 'Server error fetching train list.' });
  }
});

// GET /api/trains/active-journey - Get active passenger journey details by phone/email
router.get('/active-journey', async (req, res) => {
  try {
    await seedTrainsIfEmpty();
    const phone = req.query.phone || '';
    const email = req.query.email || '';

    if (!phone && !email) {
      return res.status(400).json({ message: 'Phone or email required.' });
    }

    // Search manifest across all trains
    const allTrains = await Train.find();
    for (const t of allTrains) {
      const passenger = t.passengers.find(p => 
        (phone && p.passengerPhone === phone) || (email && p.passengerEmail === email)
      );
      if (passenger) {
        return res.json({
          hasActiveJourney: true,
          trainNumber: t.trainNumber,
          trainName: t.trainName,
          origin: t.origin,
          destination: t.destination,
          currentStation: t.currentStation,
          delayMinutes: t.delayMinutes,
          coach: passenger.coach,
          berth: passenger.berth,
          pnr: passenger.pnr,
          passengerName: passenger.passengerName,
          passengerPhone: passenger.passengerPhone
        });
      }
    }

    return res.json({ hasActiveJourney: false });
  } catch (err) {
    console.error('Error searching active journey:', err);
    res.status(500).json({ message: 'Error checking active passenger journey.' });
  }
});

// POST /api/trains/:trainNumber/add-passenger - Officer adds a passenger travelling on this train
router.post('/:trainNumber/add-passenger', async (req, res) => {
  try {
    const { trainNumber } = req.params;
    const { passengerName, passengerPhone, passengerEmail, pnr, coach, berth } = req.body;

    if (!passengerName || !passengerPhone || !pnr || !coach || !berth) {
      return res.status(400).json({ message: 'passengerName, passengerPhone, pnr, coach, and berth are required.' });
    }

    await seedTrainsIfEmpty();
    let train = await Train.findOne({ trainNumber });
    if (!train) {
      train = new Train({
        trainNumber,
        trainName: `${trainNumber} — Express Train`,
        passengers: []
      });
    }

    // Check if passenger already exists on this train
    const existingIdx = train.passengers.findIndex(p => p.pnr === pnr || p.passengerPhone === passengerPhone);
    if (existingIdx >= 0) {
      train.passengers[existingIdx] = { passengerName, passengerPhone, passengerEmail, pnr, coach, berth };
    } else {
      train.passengers.push({ passengerName, passengerPhone, passengerEmail, pnr, coach, berth });
    }

    await train.save();
    console.log(`✅ [OFFICER TRAIN API] Added passenger ${passengerName} (${passengerPhone}) to Train ${trainNumber}, Coach ${coach}, Berth ${berth}, PNR ${pnr}`);

    res.json({ ok: true, train });
  } catch (err) {
    console.error('Error adding passenger to train manifest:', err);
    res.status(500).json({ message: 'Failed to add passenger to train manifest.' });
  }
});

// POST /api/trains/refresh-telemetry - Trigger manual 2-hr telemetry refresh
router.post('/refresh-telemetry', async (req, res) => {
  try {
    await updateAllTrainTelemetry();
    const trains = await Train.find();
    res.json({ ok: true, message: 'Updated 2-hour live telemetry for all trains', trains });
  } catch (err) {
    res.status(500).json({ message: 'Telemetry refresh failed.' });
  }
});

module.exports = router;
