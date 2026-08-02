/* =============================================================
   STUDYPLANNER BACKEND — server.js
   Express + MongoDB Atlas (Mongoose) + JWT auth, all in one file
   as requested. Sections are separated by comment headers so it's
   easy to find things even without splitting into multiple files.
   ============================================================= */

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();

// ---------- Global middleware ----------
app.use(cors({
  origin: [
    'https://study-planner-six-beige.vercel.app', // Allows your live Vercel website
    'http://localhost:5500',                      // Allows local testing
    'http://localhost:3000'                       // Allows local testing
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); // Parses incoming JSON request bodies into req.body.

// Health check route so you can easily test if the server is awake
app.get('/', (req, res) => {
  res.send('Study Planner Backend is perfectly awake and running!');
});

// ---------- Environment variables ----------
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGO_URI || !JWT_SECRET) {
  console.error('Missing MONGO_URI or JWT_SECRET in your .env file.');
  process.exit(1);
}

/* =============================================================
   DATABASE CONNECTION
   ============================================================= */

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

/* =============================================================
   SCHEMAS & MODELS
   ============================================================= */

// A registered user. Passwords are never stored in plain text —
// only the bcrypt hash is saved.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true } // bcrypt hash, not plain text
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

// A single study task, always owned by exactly one user.
const taskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    tag: { type: String, trim: true, default: '' },       // e.g. subject: "Physics"
    meta: { type: String, trim: true, default: '' },      // e.g. "Due 5:00 PM" / "Tomorrow"
    status: { type: String, enum: ['today', 'upcoming', 'completed'], default: 'today' }
  },
  { timestamps: true }
);

const Task = mongoose.model('Task', taskSchema);

/* =============================================================
   AUTH MIDDLEWARE
   Verifies the JWT sent in the Authorization header and attaches
   the decoded user id to req.userId for downstream routes.
   Expected header format: "Authorization: Bearer <token>"
   ============================================================= */

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

/* =============================================================
   AUTH ROUTES
   ============================================================= */

// POST /api/register — creates a new user account and returns a token,
// so the frontend can log the person straight in after registering.
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are all required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword
    });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Something went wrong while registering.' });
  }
});

// POST /api/login — verifies credentials and returns a fresh token.
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Something went wrong while logging in.' });
  }
});

/* =============================================================
   TASK ROUTES (all protected by requireAuth)
   Every route below only ever touches tasks that belong to the
   logged-in user (req.userId), so one person can never see or
   edit another person's tasks.
   ============================================================= */

// GET /api/tasks — returns every task belonging to the logged-in user.
app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.userId }).sort({ createdAt: 1 });
    res.json(tasks);
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ message: 'Could not fetch tasks.' });
  }
});

// POST /api/tasks — creates a new task for the logged-in user.
app.post('/api/tasks', requireAuth, async (req, res) => {
  try {
    const { title, tag, meta, status } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Task title is required.' });
    }

    const task = await Task.create({
      user: req.userId,
      title,
      tag,
      meta,
      status: status || 'today'
    });

    res.status(201).json(task);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ message: 'Could not create task.' });
  }
});

// PUT /api/tasks/:id — updates a task (title, tag, meta, or status —
// e.g. toggling it to "completed"). Only works on the caller's own task.
app.put('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    res.json(task);
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ message: 'Could not update task.' });
  }
});

// DELETE /api/tasks/:id — deletes a task. Only works on the caller's own task.
app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.userId });

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    res.json({ message: 'Task deleted.' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ message: 'Could not delete task.' });
  }
});

/* =============================================================
   START SERVER
   ============================================================= */

app.listen(PORT, () => {
  console.log(`StudyPlanner backend running on http://localhost:${PORT}`);
});
