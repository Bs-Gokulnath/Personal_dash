// Import the full Telegram session to database
require('dotenv').config();
const mongoose = require('mongoose');
const TelegramSession = require('./models/TelegramSession');
const fs = require('fs');

async function importSession() {
    try {
        // Read the full session string from file
        const sessionString = fs.readFileSync('telegram-session-string.txt', 'utf8').trim();
        const phoneNumber = '+916380983912';
        const userId = 'anonymous';

        console.log(`📋 Read session string: ${sessionString.length} characters`);
        console.log(`🔑 Preview: ${sessionString.substring(0, 30)}...`);

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Delete old session first
        const deleted = await TelegramSession.deleteMany({ userId });
        console.log(`🗑️  Deleted ${deleted.deletedCount} old session(s)`);

        // Save the new full session using findOneAndUpdate (handles encryption)
        const session = await TelegramSession.findOneAndUpdate(
            { userId },
            {
                $set: {
                    userId,
                    phoneNumber,
                    sessionString, // Will be encrypted by setter
                    isActive: true,
                    lastSync: new Date()
                }
            },
            { 
                upsert: true, 
                new: true,
                runValidators: true
            }
        );

        console.log('✅ Full Telegram session saved to database!');
        console.log('📱 Phone:', phoneNumber);
        console.log('🔑 Session ID:', session._id);
        console.log(`📏 Saved ${sessionString.length} character session`);
        
        await mongoose.disconnect();
        console.log('\n🎉 SUCCESS! Now restart your backend server!\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

importSession();
