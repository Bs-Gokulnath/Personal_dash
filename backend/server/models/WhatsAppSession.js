const mongoose = require('mongoose');
const crypto = require('crypto');

const conversationSchema = new mongoose.Schema({
    chatId: {
        type: String,
        required: true
    },
    contactName: {
        type: String,
        default: 'Unknown'
    },
    contactPhone: {
        type: String,
        required: true
    },
    lastMessage: {
        type: String,
        default: ''
    },
    lastMessageTime: {
        type: Date,
        default: Date.now
    },
    unreadCount: {
        type: Number,
        default: 0
    },
    messageHistory: [{
        messageId: String,
        from: String,
        to: String,
        text: String,
        timestamp: Date,
        status: String, // sent, delivered, read, failed
        type: String // text, image, document, etc.
    }]
});

const whatsappSessionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    phoneNumberId: {
        type: String,
        required: true
    },
    businessAccountId: {
        type: String,
        required: true
    },
    displayPhoneNumber: {
        type: String,
        default: ''
    },
    accessToken: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    conversations: [conversationSchema],
    lastSync: {
        type: Date,
        default: Date.now
    },
    metadata: {
        businessName: String,
        businessCategory: String,
        verifiedName: String,
        qualityRating: String // GREEN, YELLOW, RED
    }
}, {
    timestamps: true
});

// Encrypt access token before saving
whatsappSessionSchema.pre('save', function(next) {
    if (this.isModified('accessToken') && this.accessToken) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key-change-in-production', 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encrypted = cipher.update(this.accessToken, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        this.accessToken = iv.toString('hex') + ':' + encrypted;
    }
    next();
});

// Decrypt access token when retrieving
whatsappSessionSchema.methods.getDecryptedToken = function() {
    try {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key-change-in-production', 'salt', 32);
        
        const parts = this.accessToken.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Error decrypting token:', error);
        return this.accessToken; // Return as-is if decryption fails (for backward compatibility)
    }
};

// Add or update conversation
whatsappSessionSchema.methods.updateConversation = function(chatId, contactPhone, contactName, lastMessage) {
    const existingConv = this.conversations.find(c => c.chatId === chatId);
    
    if (existingConv) {
        existingConv.lastMessage = lastMessage;
        existingConv.lastMessageTime = new Date();
        existingConv.contactName = contactName || existingConv.contactName;
    } else {
        this.conversations.push({
            chatId,
            contactPhone,
            contactName: contactName || contactPhone,
            lastMessage,
            lastMessageTime: new Date(),
            unreadCount: 0
        });
    }
    
    this.lastSync = new Date();
};

// Add message to conversation history
whatsappSessionSchema.methods.addMessage = function(chatId, messageData) {
    const conversation = this.conversations.find(c => c.chatId === chatId);
    
    if (conversation) {
        conversation.messageHistory.push({
            messageId: messageData.id,
            from: messageData.from,
            to: messageData.to,
            text: messageData.text,
            timestamp: messageData.timestamp || new Date(),
            status: messageData.status || 'sent',
            type: messageData.type || 'text'
        });
        
        // Keep only last 100 messages per conversation to avoid document size issues
        if (conversation.messageHistory.length > 100) {
            conversation.messageHistory = conversation.messageHistory.slice(-100);
        }
    }
};

const WhatsAppSession = mongoose.model('WhatsAppSession', whatsappSessionSchema);

module.exports = WhatsAppSession;
