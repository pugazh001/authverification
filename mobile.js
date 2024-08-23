// Node.js script to generate a random secret key
// const crypto = require('crypto');
// const secret = crypto.randomBytes(64).toString('hex');
// console.log(secret);
const express = require('express');
const mongoose = require('mongoose');
const twilio = require('twilio');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Define the User model using Mongoose
const userSchema = new mongoose.Schema({
    mobile: { type: String, required: true, unique: true },
    otp: { type: String },
    otpExpires: { type: Date }
});

const User = mongoose.model('User', userSchema);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mobile_verify', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Twilio setup
const twilioClient = new twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// Register user and send OTP
app.post('/register', async (req, res) => {
    const { mobile } = req.body;
    const otp = crypto.randomInt(100000, 999999).toString();

    try {
        let user = await User.findOne({ mobile });
        if (!user) {
            user = new User({ mobile });
        }
        user.otp = otp;
        user.otpExpires = Date.now() + 15 * 60 * 1000; // OTP valid for 15 minutes
        await user.save();

        // Send OTP via SMS
        await twilioClient.messages.create({
            body: `Your OTP code is ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: mobile
        });

        res.send('OTP sent to your mobile.');
    } catch (error) {
        res.status(500).send('Error registering user: ' + error.message);
    }
});

// Verify OTP
app.post('/verify-otp', async (req, res) => {
    const { mobile, otp } = req.body;

    try {
        const user = await User.findOne({ mobile });
        if (!user || user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).send({ message: 'Invalid or expired OTP' });
        }

        // OTP verified
        res.send({ message: 'OTP verified successfully!' });
    } catch (error) {
        res.status(500).send('Error verifying OTP: ' + error.message);
    }
});

// Start server
const port = process.env.PORT || 3002;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
