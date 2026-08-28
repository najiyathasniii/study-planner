require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');

const app = express();

// Initialize Resend with your environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

// ==========================================
// 1. MIDDLEWARE CONFIGURATION
// ==========================================
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';

// ==========================================
// 2. MONGOOSE SCHEMAS & MODELS
// ==========================================

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

const TaskSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    completed: { type: Boolean, default: false },
    date: { type: String, default: () => new Date().toISOString().split('T')[0] }
}, { timestamps: true });

const Task = mongoose.model('Task', TaskSchema);

const ExamSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    subject: { type: String, default: 'General' },
    dueDate: { type: String, required: true }
}, { timestamps: true });

const Exam = mongoose.model('Exam', ExamSchema);

const NoteSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    subject: { type: String, default: 'General' },
    fileName: String,
    fileType: String,
    fileData: String,
    date: String
}, { timestamps: true });

const Note = mongoose.model('Note', NoteSchema);

// ==========================================
// 3. AUTHENTICATION MIDDLEWARE
// ==========================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// ==========================================
// 4. AUTHENTICATION & PROFILE ROUTES
// ==========================================

// Register User
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();

        const token = jwt.sign({ id: newUser._id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email, avatar: newUser.avatar } });
    } catch (err) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login User
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar } });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// FORGOT PASSWORD ROUTE (POWERED BY RESEND)
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(200).json({ message: 'If an account exists, reset instructions have been processed.' });
        }

        const resetToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '15m' });
        const resetLink = `https://study-planner-six-beige.vercel.app/reset-password.html?token=${resetToken}`;

        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: email,
            subject: 'Study Planner - Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Password Reset Request</h2>
                    <p>Click the button below to reset your password. This link is valid for 15 minutes:</p>
                    <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 5px;">Reset Password</a>
                </div>
            `
        });

        res.status(200).json({ message: 'Password reset link sent to your email.' });

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Failed to send reset email' });
    }
});

// Change Password
app.post('/api/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Incorrect current password' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: 'Password changed successfully!' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// GET USER PROFILE
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ name: user.name, email: user.email, avatar: user.avatar || '' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// UPDATE USER PROFILE & AVATAR
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { name, avatar } = req.body;
        const updateData = {};

        if (name) updateData.name = name;
        if (avatar !== undefined) updateData.avatar = avatar;

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updateData },
            { new: true }
        );

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                avatar: updatedUser.avatar
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ==========================================
// 5. TASKS API ROUTES
// ==========================================

app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const tasks = await Task.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const { title, completed, date } = req.body;
        const newTask = new Task({
            userId: req.user.id,
            title,
            completed: completed || false,
            date: date || new Date().toISOString().split('T')[0]
        });
        await newTask.save();
        res.status(201).json(newTask);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create task' });
    }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const { completed, title, date } = req.body; 
        
        const updatedTask = await Task.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { $set: { 
                ...(completed !== undefined && { completed }), 
                ...(title && { title }),
                ...(date && { date }) 
            } },
            { new: true }
        );
        res.json(updatedTask);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update task' });
    }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        await Task.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.json({ message: 'Task deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// ==========================================
// 6. EXAMS & ASSIGNMENTS API ROUTES
// ==========================================

app.get('/api/exams', authenticateToken, async (req, res) => {
    try {
        const exams = await Exam.find({ userId: req.user.id }).sort({ dueDate: 1 });
        res.json(exams);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch exams' });
    }
});

app.post('/api/exams', authenticateToken, async (req, res) => {
    try {
        const { title, subject, dueDate } = req.body;
        const newExam = new Exam({
            userId: req.user.id,
            title,
            subject,
            dueDate
        });
        await newExam.save();
        res.status(201).json(newExam);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save exam' });
    }
});

app.delete('/api/exams/:id', authenticateToken, async (req, res) => {
    try {
        await Exam.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.json({ message: 'Exam deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete exam' });
    }
});

// ==========================================
// 7. PDF & NOTES HUB API ROUTES
// ==========================================

app.get('/api/notes', authenticateToken, async (req, res) => {
    try {
        const notes = await Note.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

app.post('/api/notes', authenticateToken, async (req, res) => {
    try {
        const { title, subject, fileName, fileType, fileData, date } = req.body;
        const newNote = new Note({
            userId: req.user.id,
            title,
            subject,
            fileName,
            fileType,
            fileData,
            date
        });
        await newNote.save();
        res.status(201).json(newNote);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save note' });
    }
});

app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
    try {
        await Note.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.json({ message: 'Note deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete note' });
    }
});

// ==========================================
// 8. DATABASE CONNECTION & SERVER LISTEN
// ==========================================
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://thasnimk1234_db_user:thasnimk1234@cluster0.s1gvlri.mongodb.net/studyPlanner?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch((err) => {
        console.error('❌ MongoDB Connection Error:', err);
    });
