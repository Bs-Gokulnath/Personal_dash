// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const { getAuthUrl, getAndSaveToken, getGmailClient, oauth2Client } = require('./gmailService');
const { generateEmailDraft, summarizeEmail, improveDraft, testConnection } = require('./services/aiService');
const EmailDraft = require('./models/EmailDraft');
const AIInteraction = require('./models/AIInteraction');
const { connectDB, isDBConnected } = require('./config/database');

// Connect to MongoDB (will warn if not configured)
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.send('Personal Dashboard API is running');
});

// --- Gmail Auth Routes ---

// 1. Redirect user to Google to login
app.get('/auth/google', async (req, res) => {
  try {
    const forceConsent = req.query.force === 'true';
    const url = await getAuthUrl(forceConsent);
    res.redirect(url);
  } catch (error) {
    console.error('Auth Error:', error);
    res.status(500).send('Error generating auth URL. Did you add credentials.json?');
  }
});

// 2. Callback URL where Google redirects back with a code
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');

  try {
    await getAndSaveToken(code);
    res.send('Authentication successful! You can now close this tab and return to the dashboard.');
  } catch (error) {
    console.error('Token Error:', error);
    res.status(500).send('Error retrieving token');
  }
});

// 3. Get emails endpoint
app.get('/api/emails', async (req, res) => {
  try {
    const gmail = await getGmailClient();
    if (!gmail) {
      return res.status(401).json({ error: 'Not authenticated. Go to http://localhost:5000/auth/google' });
    }

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
    });

    const messages = response.data.messages || [];
    
    // Helper to decode base64url
    const decodeBase64 = (data) => {
      if (!data) return '';
      const buff = Buffer.from(data, 'base64');
      return buff.toString('utf-8');
    };

    // Helper to find body in parts
    const getBody = (payload) => {
      if (payload.body && payload.body.data) {
        return decodeBase64(payload.body.data);
      }
      if (payload.parts) {
        // Prefer HTML, fallback to text
        const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
        if (htmlPart) return getBody(htmlPart);
        
        const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
        if (textPart) return getBody(textPart);
        
        // Recursively check nested parts
        for (const part of payload.parts) {
            const body = getBody(part);
            if (body) return body;
        }
      }
      return '';
    };

    // Fetch details for each message
    const fullMessages = await Promise.all(messages.map(async (msg) => {
      const details = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
      });
      
      const headers = details.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const snippet = details.data.snippet;
      const body = getBody(details.data.payload);
      const internalDate = new Date(parseInt(details.data.internalDate)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        id: msg.id,
        source: 'Mail',
        sender: from,
        preview: snippet,
        time: internalDate,
        subject: subject,
        body: body
      };
    }));

    res.json(fullMessages);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// 4. Send Email Endpoint
app.post('/api/send-email', async (req, res) => {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
        return res.status(400).json({ error: "Missing required fields: to, subject, body" });
    }

    try {
        // Get authenticated Gmail client
        const gmail = await getGmailClient();
        if (!gmail) {
            return res.status(401).json({ error: "Not authenticated. Please authenticate first." });
        }

        // Construct the raw email
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
            `To: ${to}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            body
        ];

        const message = messageParts.join('\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });

        res.json({ success: true, message: "Email sent successfully" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: "Failed to send email", details: error.message });
    }
});

// --- AI Assistant Endpoints ---

// 5. Test AI Connection
app.get('/api/ai/test', async (req, res) => {
    try {
        const result = await testConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Generate Email Draft from Prompt
app.post('/api/ai/generate-draft', async (req, res) => {
    const { prompt, emailContext, tone } = req.body;
    const userId = req.headers['x-user-id'] || 'anonymous'; // Will integrate with Firebase auth later

    if (!prompt) {
        return res.status(400).json({ error: "prompt is required" });
    }

    const startTime = Date.now();

    try {
        // Generate draft using AI
        const result = await generateEmailDraft(prompt, emailContext, tone);

        const responseTime = Date.now() - startTime;

        if (!result.success) {
            console.error('AI Draft Generation Failed:', result.error);
            // Log failed interaction
            if (isDBConnected()) {
                await AIInteraction.create({
                    userId,
                    action: 'generate',
                    input: prompt,
                    output: '',
                    responseTime,
                    success: false,
                    error: result.error
                });
            }
            return res.status(500).json({ error: result.error, details: 'Check server logs for more info' });
        }

        // Save draft to database if connected
        let draftId = null;
        if (isDBConnected()) {
            const draft = await EmailDraft.create({
                userId,
                originalEmailId: emailContext?.originalEmail?.id || null,
                draftContent: result.draft,
                userPrompt: prompt,
                tone: tone || 'professional',
                aiProvider: result.metadata.provider,
                metadata: {
                    modelVersion: result.metadata.model,
                    generationTime: responseTime
                }
            });
            draftId = draft._id.toString();

            // Log successful interaction
            await AIInteraction.create({
                userId,
                action: 'generate',
                input: prompt,
                output: JSON.stringify(result.draft),
                responseTime,
                success: true
            });
        }

        res.json({
            success: true,
            draftId,
            draft: result.draft,
            metadata: {
                ...result.metadata,
                responseTime
            }
        });

    } catch (error) {
        console.error("Error generating draft:", error);
        res.status(500).json({ error: "Failed to generate draft", details: error.message });
    }
});

// 7. Summarize Email
app.post('/api/ai/summarize-email', async (req, res) => {
    const { emailContent, emailId } = req.body;
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!emailContent) {
        return res.status(400).json({ error: "emailContent is required" });
    }

    const startTime = Date.now();

    try {
        const result = await summarizeEmail(emailContent);
        const responseTime = Date.now() - startTime;

        if (!result.success) {
            if (isDBConnected()) {
                await AIInteraction.create({
                    userId,
                    action: 'summarize',
                    input: emailContent.substring(0, 500),
                    output: '',
                    responseTime,
                    success: false,
                    error: result.error
                });
            }
            return res.status(500).json({ error: result.error });
        }

        // Log successful summarization
        if (isDBConnected()) {
            await AIInteraction.create({
                userId,
                action: 'summarize',
                input: emailContent.substring(0, 500),
                output: result.summary,
                responseTime,
                success: true
            });
        }

        res.json({
            success: true,
            summary: result.summary,
            keyPoints: result.keyPoints,
            metadata: {
                ...result.metadata,
                responseTime
            }
        });

    } catch (error) {
        console.error("Error summarizing email:", error);
        res.status(500).json({ error: "Failed to summarize email", details: error.message });
    }
});

// 8. Improve Email Draft
app.post('/api/ai/improve-draft', async (req, res) => {
    const { draftId, currentDraft, instruction } = req.body;
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!currentDraft || !instruction) {
        return res.status(400).json({ error: "currentDraft and instruction are required" });
    }

    const startTime = Date.now();

    try {
        const result = await improveDraft(currentDraft, instruction);
        const responseTime = Date.now() - startTime;

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        // Update draft in database if draftId provided and DB is connected
        if (draftId && isDBConnected()) {
            await EmailDraft.findByIdAndUpdate(draftId, {
                'draftContent.body': result.improvedBody,
                $push: {
                    'metadata.improvements': {
                        instruction,
                        timestamp: new Date()
                    }
                }
            });
        }

        // Log interaction
        if (isDBConnected()) {
            await AIInteraction.create({
                userId,
                action: 'improve',
                input: instruction,
                output: result.improvedBody.substring(0, 500),
                responseTime,
                success: true
            });
        }

        res.json({
            success: true,
            improvedBody: result.improvedBody,
            metadata: {
                ...result.metadata,
                responseTime
            }
        });

    } catch (error) {
        console.error("Error improving draft:", error);
        res.status(500).json({ error: "Failed to improve draft", details: error.message });
    }
});

// 9. Get User's Drafts
app.get('/api/drafts', async (req, res) => {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const status = req.query.status; // optional filter

    if (!isDBConnected()) {
        return res.json({ drafts: [], message: 'Database not connected' });
    }

    try {
        const query = { userId };
        if (status) {
            query.status = status;
        }

        const drafts = await EmailDraft.find(query)
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ drafts });

    } catch (error) {
        console.error("Error fetching drafts:", error);
        res.status(500).json({ error: "Failed to fetch drafts", details: error.message });
    }
});

// 10. Approve and Send Draft
app.put('/api/drafts/:draftId/approve', async (req, res) => {
    const { draftId } = req.params;
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Cannot manage drafts.' });
    }

    try {
        // Get the draft
        const draft = await EmailDraft.findOne({ _id: draftId, userId });

        if (!draft) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        // Send the email using existing send-email logic
        const gmail = await getGmailClient();
        if (!gmail) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const { to, subject, body } = draft.draftContent;

        // Construct and send email
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
            `To: ${to}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            body
        ];

        const message = messageParts.join('\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });

        // Update draft status
        draft.status = 'sent';
        draft.sentAt = new Date();
        await draft.save();

        res.json({ success: true, message: "Email sent successfully", draft });

    } catch (error) {
        console.error("Error approving and sending draft:", error);
        res.status(500).json({ error: "Failed to send email", details: error.message });
    }
});

// 11. Delete/Reject Draft
app.delete('/api/drafts/:draftId', async (req, res) => {
    const { draftId } = req.params;
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!isDBConnected()) {
        return res.json({ success: true, message: 'Database not connected' });
    }

    try {
        const draft = await EmailDraft.findOneAndUpdate(
            { _id: draftId, userId },
            { status: 'rejected' },
            { new: true }
        );

        if (!draft) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        res.json({ success: true, message: 'Draft rejected' });

    } catch (error) {
        console.error("Error deleting draft:", error);
        res.status(500).json({ error: "Failed to delete draft", details: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
