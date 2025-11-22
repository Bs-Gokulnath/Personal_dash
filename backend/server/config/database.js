const mongoose = require('mongoose');
require('dotenv').config();

let isConnected = false;

/**
 * Connect to MongoDB
 * For now, will work without DB until user sets up MongoDB Atlas
 */
async function connectDB() {
    if (isConnected) {
        console.log('MongoDB already connected');
        return;
    }

    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
        console.warn('⚠️  MongoDB URI not configured. Draft persistence disabled.');
        console.warn('   To enable: Set MONGODB_URI in .env file');
        return null;
    }

    try {
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        isConnected = true;
        console.log('✅ MongoDB connected successfully');
        return mongoose.connection;

    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.warn('   Continuing without database. Drafts will not be saved.');
        return null;
    }
}

/**
 * Check if MongoDB is connected
 */
function isDBConnected() {
    return isConnected && mongoose.connection.readyState === 1;
}

module.exports = {
    connectDB,
    isDBConnected
};
