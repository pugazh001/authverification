const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cors = require('cors');

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
// Define the User model using Mongoose
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true },
    otp: { type: String },
    otpExpires: { type: Date }
});

const User = mongoose.model('User', userSchema);

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/email_verify', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Nodemailer transport setup
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER ,
        pass: process.env.EMAIL_PASS 
    }
});

// Register user and send OTP
app.post('/register', async (req, res) => {
    const { email, mobile } = req.body;
    const otp = crypto.randomInt(100000, 999999).toString();

    try {
        let user = await User.findOne({ email });
        if (!user) {
            user = new User({ email, mobile });
        }
        user.otp = otp;
        user.otpExpires = Date.now() + 15 * 60 * 1000; // OTP valid for 15 minutes
        await user.save();

        // Send OTP via email
        await transporter.sendMail({
            to: email,
            subject: 'Your OTP Code',
            text: `Your OTP code is ${otp}`
        });

        res.send('OTP sent to your email.');
    } catch (error) {
        res.status(500).send('Error registering user: ' + error.message);
    }
});

// Verify OTP
app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user || user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).send({ message: 'Invalid or expired OTP' });
        }

        // OTP verified, generate JWT
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.send({ token });
    } catch (error) {
        res.status(500).send('Error verifying OTP: ' + error.message);
    }
});

// Start server
const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
