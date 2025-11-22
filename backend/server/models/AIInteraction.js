const mongoose = require('mongoose');

const aiInteractionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: ['generate', 'summarize', 'improve'],
    required: true
  },
  input: {
    type: String,
    required: true
  },
  output: {
    type: String,
    default: ''
  },
  tokensUsed: {
    type: Number,
    default: 0
  },
  responseTime: {
    type: Number,  // in milliseconds
    required: true
  },
  success: {
    type: Boolean,
    default: true
  },
  error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for analytics queries
aiInteractionSchema.index({ userId: 1, createdAt: -1 });
aiInteractionSchema.index({ action: 1, createdAt: -1 });

// Auto-delete old interactions after 90 days
aiInteractionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const AIInteraction = mongoose.model('AIInteraction', aiInteractionSchema);

module.exports = AIInteraction;
