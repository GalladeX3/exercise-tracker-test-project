require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const User = require('./models/User');
const Exercise = require('./models/Exercise');

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.urlencoded({ extended: false })); // for form data
app.use(express.json()); // for JSON
app.use(express.static('public'));

// --- DB Connect ---
const { MONGO_URI, PORT } = process.env;
mongoose
  .connect(MONGO_URI, { dbName: 'fcc-exercise-tracker' })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('Mongo connection error:', err.message));

// --- Helper: format date string per FCC ---
const toFCCDateString = (d) => new Date(d).toDateString(); // "Mon Jan 01 1990"

// --- Routes ---

// Root helper page (optional)
app.get('/', (_req, res) => {
  res.sendFile(process.cwd() + '/public/index.html');
});

// 2 & 3) POST /api/users  -> create user
app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'username is required' });
    }
    const user = await User.create({ username: username.trim() });
    // FCC wants { username, _id }
    res.json({ username: user.username, _id: user._id });
  } catch (err) {
    // If unique constraint hits, just find and return it (FCC doesn’t mandate uniqueness handling)
    if (err.code === 11000 && err.keyPattern?.username) {
      const existing = await User.findOne({ username: req.body.username.trim() }).lean();
      return res.json({ username: existing.username, _id: existing._id });
    }
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// 4,5,6) GET /api/users -> list users
app.get('/api/users', async (_req, res) => {
  try {
    const users = await User.find({}, { username: 1 }).lean();
    // each element must contain username and _id
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// 7 & 8) POST /api/users/:_id/exercises
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const { _id } = req.params;
    const { description, duration, date } = req.body;

    const user = await User.findById(_id).lean();
    if (!user) return res.status(404).json({ error: 'user not found' });

    // Duration must be number
    const dur = Number(duration);
    if (!description || !dur) {
      return res.status(400).json({ error: 'description and duration are required' });
    }

    // Date: if not provided or invalid, use current date
    let d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) d = new Date();

    const ex = await Exercise.create({
      userId: user._id,
      description: description.trim(),
      duration: dur,
      date: d
    });

    // Response format:
    // { _id, username, date: toDateString, duration: Number, description: String }
    res.json({
      _id: user._id,
      username: user.username,
      date: toFCCDateString(ex.date),
      duration: ex.duration,
      description: ex.description
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// 9,10,11,12,13,14,15,16) GET /api/users/:_id/logs?from&to&limit
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const { _id } = req.params;
    let { from, to, limit } = req.query;

    const user = await User.findById(_id).lean();
    if (!user) return res.status(404).json({ error: 'user not found' });

    const query = { userId: user._id };

    // Date range filter (from/to in yyyy-mm-dd)
    if (from || to) {
      query.date = {};
      if (from) {
        const fd = new Date(from);
        if (!isNaN(fd.getTime())) query.date.$gte = fd;
      }
      if (to) {
        const td = new Date(to);
        if (!isNaN(td.getTime())) query.date.$lte = td;
      }
      // clean up empty date filter
      if (Object.keys(query.date).length === 0) delete query.date;
    }

    // Limit
    let lim = parseInt(limit, 10);
    if (isNaN(lim) || lim < 1) lim = undefined;

    const exercises = await Exercise.find(query, null, {
      sort: { date: 1 },
      limit: lim
    }).lean();

    const log = exercises.map((e) => ({
      description: e.description,
      duration: e.duration,
      date: toFCCDateString(e.date)
    }));

    res.json({
      username: user.username,
      count: exercises.length,
      _id: user._id,
      log
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// --- Start server ---
const port = Number(PORT) || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));

