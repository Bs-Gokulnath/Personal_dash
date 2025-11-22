const mongoose = require('mongoose');

const emailDraftSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  originalEmailId: {
    type: String,  // Gmail message ID if this is a reply
    default: null
  },
  draftContent: {
    to: {
      type: String,
      required: true
    },
    subject: {
      type: String,
      required: true
    },
    body: {
      type: String,
      required: true
    }
  },
  userPrompt: {
    type: String,
    required: true
  },
  tone: {
    type: String,
    enum: ['professional', 'casual', 'formal'],
    default: 'professional'
  },
  aiProvider: {
    type: String,
    default: 'gemini'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'sent', 'rejected'],
    default: 'pending',
    index: true
  },
  sentAt: {
    type: Date,
    default: null
  },
  metadata: {
    tokensUsed: Number,
    modelVersion: String,
    generationTime: Number
  }
}, {
  timestamps: true  // Adds createdAt and updatedAt
});

// Index for querying user's pending drafts
emailDraftSchema.index({ userId: 1, status: 1 });

// Auto-delete old rejected drafts after 90 days
emailDraftSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

const EmailDraft = mongoose.model('EmailDraft', emailDraftSchema);

module.exports = EmailDraft;
