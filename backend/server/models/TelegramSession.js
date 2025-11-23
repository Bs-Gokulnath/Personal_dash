const mongoose = require('mongoose');
const CryptoJS = require('crypto-js');

const telegramSessionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  sessionString: {
    type: String,
    required: true,
    // Encrypted before saving
    set: function(value) {
      const key = process.env.SESSION_ENCRYPTION_KEY;
      return CryptoJS.AES.encrypt(value, key).toString();
    },
    // Decrypted when reading
    get: function(value) {
      if (!value) return '';
      const key = process.env.SESSION_ENCRYPTION_KEY;
      const bytes = CryptoJS.AES.decrypt(value, key);
      return bytes.toString(CryptoJS.enc.Utf8);
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSync: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

module.exports = mongoose.model('TelegramSession', telegramSessionSchema);
