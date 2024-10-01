import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Define User schema and model
const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    email: String,
    mobno: String
});

const User = mongoose.model('User', userSchema);

// Login route
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Find user by username (which can be email or mobno)
        const user = await User.findOne({
            $or: [{ email: username }, { mobno: username }]
        });

        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        // Check password
        if (user.password !== password) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        // Successful login
        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;