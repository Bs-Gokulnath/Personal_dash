// Save the telegram session to database
require('dotenv').config();
const mongoose = require('mongoose');
const TelegramSession = require('./models/TelegramSession');

const sessionString = '1BQANOTEuMTA4LjU2LjE1OAG7eLkPnsnGdc3JIGAl/8kF5zokf'; // Truncated in output - we'll get the full one
const phoneNumber = '+916380983912';
const userId = 'anonymous'; // You can change this to your Firebase UID later

async function saveSession() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Save the session
        const session = await TelegramSession.findOneAndUpdate(
            { userId },
            {
                userId,
                phoneNumber,
                sessionString,
                isActive: true,
                lastSync: new Date()
            },
            { upsert: true, new: true }
        );

        console.log('✅ Telegram session saved to database!');
        console.log('📱 Phone:', session.phoneNumber);
        console.log('🔑 Session ID:', session._id);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

saveSession();
