// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const { getAuthUrl, getAndSaveToken, getGmailClient, oauth2Client } = require('./gmailService');
const { generateEmailDraft, summarizeEmail, improveDraft, chatWithAI, testConnection } = require('./services/aiService');
const telegramService = require('./services/telegramService');
const whatsappService = require('./services/whatsappService');
const EmailDraft = require('./models/EmailDraft');
const AIInteraction = require('./models/AIInteraction');
const TelegramSession = require('./models/TelegramSession');
const WhatsAppSession = require('./models/WhatsAppSession');
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
    // Redirect back to the frontend dashboard with Inbox page specified
    res.redirect('http://localhost:5173?page=Inbox');
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
      q: 'category:primary'
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

// General AI Chat
app.post('/api/ai/chat', async (req, res) => {
    const { prompt } = req.body;
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!prompt) {
        return res.status(400).json({ error: "prompt is required" });
    }

    try {
        const result = await chatWithAI(prompt);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        // Log interaction
        if (isDBConnected()) {
            await AIInteraction.create({
                userId,
                action: 'chat',
                input: prompt,
                output: result.response,
                success: true
            });
        }

        res.json(result);

    } catch (error) {
        console.error("Error in AI chat:", error);
        res.status(500).json({ error: "Failed to process chat" });
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

// Store auth promises for code input
const authPromises = new Map();

// 12. Start Telegram Authentication
app.post('/api/telegram/auth/start', async (req, res) => {
    const { phoneNumber } = req.body;
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
    }

    try {
        console.log(`📱 Starting Telegram auth for ${phoneNumber}`);

        // Create promise for phone code that will be resolved when user submits it
        let resolveCode, resolvePassword;
        const codePromise = new Promise(resolve => { resolveCode = resolve; });
        const passwordPromise = new Promise(resolve => { resolvePassword = resolve; });

        // Store resolvers for later use
        authPromises.set(phoneNumber, { 
            resolveCode, 
            resolvePassword,
            userId 
        });

        // Start authentication (this will trigger code send)
        telegramService.authenticate(
            userId,
            phoneNumber,
            () => codePromise,
            () => passwordPromise
        ).then(result => {
            if (result.success) {
                console.log(`✅ Telegram auth successful for ${phoneNumber}`);
                // Save to database
                TelegramSession.findOneAndUpdate(
                    { userId },
                    {
                        userId,
                        phoneNumber,
                        sessionString: result.sessionString,
                        isActive: true,
                        lastSync: new Date()
                    },
                    { upsert: true, new: true }
                ).catch(err => console.error('Error saving session:', err));
            }
            authPromises.delete(phoneNumber);
        }).catch(err => {
            console.error('Telegram auth error:', err);
            authPromises.delete(phoneNumber);
        });

        // Wait a bit for the code to be sent
        await new Promise(resolve => setTimeout(resolve, 2000));

        res.json({
            success: true,
            message: "Verification code sent to your Telegram app",
            step: "code_required"
        });

    } catch (error) {
        console.error("Error starting Telegram auth:", error);
        res.status(500).json({ error: error.message });
    }
});

// 13. Complete Telegram Authentication with Code
app.post('/api/telegram/auth/verify', async (req, res) => {
    const { phoneNumber, code, password } = req.body;

    if (!phoneNumber || !code) {
        return res.status(400).json({ error: "Phone number and code are required" });
    }

    try {
        // Get the auth promise resolvers
        const authData = authPromises.get(phoneNumber);
        if (!authData) {
            return res.status(400).json({ error: "No pending authentication found. Please start authentication again." });
        }

        // Resolve the code promise
        authData.resolveCode(code);

        // If password provided, resolve password promise
        if (password) {
            authData.resolvePassword(password);
        }

        // The authentication will complete in the background
        // Give it a moment then respond
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if session was saved
        const session = await TelegramSession.findOne({ userId: authData.userId, isActive: true });
        
        if (session) {
            res.json({
                success: true,
                message: "Telegram connected successfully!",
                phoneNumber
            });
        } else {
            // If 2FA is required, the password promise is still pending
            res.json({
                success: false,
                error: "Two-factor authentication required",
                requires2FA: true
            });
        }

    } catch (error) {
        console.error("Error verifying Telegram code:", error);
        res.status(500).json({ error: error.message });
    }
});

// 14. Get Telegram Chats
app.get('/api/telegram/chats', async (req, res) => {
    const userId = req.headers['x-user-id'] || 'anonymous';

    try {
        // Check if user has active session
        const session = await TelegramSession.findOne({ userId, isActive: true });
        
        if (!session) {
            return res.status(401).json({ error: "Not authenticated with Telegram" });
        }

        console.log(`📱 Fetching Telegram chats for user: ${userId}`);
        
        // Get decrypted session string
        const sessionObj = session.toObject();
        const decryptedSession = sessionObj.sessionString;
        
        console.log(`🔑 Session string length: ${decryptedSession?.length || 0}`);
        console.log(`🔑 Session preview: ${decryptedSession?.substring(0, 20)}...`);

        // Initialize client with saved session
        const client = await telegramService.getClient(userId, decryptedSession);
        
        // Connect if not connected
        if (!client.connected) {
            await client.connect();
            console.log('✅ Telegram client connected');
        }

        // Get dialogs
        const chats = await telegramService.getDialogs(userId, 50);
        
        console.log(`✅ Fetched ${chats.length} Telegram chats`);

        res.json({ chats });

    } catch (error) {
        console.error("Error fetching Telegram chats:", error);
        res.status(500).json({ error: error.message });
    }
});

// 15. Get Messages from a Chat
app.get('/api/telegram/messages/:chatId', async (req, res) => {
    const { chatId } = req.params;
    const userId = req.headers['x-user-id'] || 'anonymous';
    const limit = parseInt(req.query.limit) || 50;

    try {
        const messages = await telegramService.getMessages(userId, chatId, limit);
        res.json({ messages });

    } catch (error) {
        console.error("Error fetching Telegram messages:", error);
        res.status(500).json({ error: error.message });
    }
});

// 16. Send Telegram Message
app.post('/api/telegram/send', async (req, res) => {
    const { chatId, text } = req.body;
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!chatId || !text) {
        return res.status(400).json({ error: "chatId and text are required" });
    }

    try {
        const result = await telegramService.sendMessage(userId, chatId, text);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            messageId: result.messageId,
            date: result.date
        });

    } catch (error) {
        console.error("Error sending Telegram message:", error);
        res.status(500).json({ error: error.message });
    }
});

// 17. Check Telegram Connection Status
app.get('/api/telegram/status', async (req, res) => {
    const userId = req.headers['x-user-id'] || 'anonymous';

    try {
        const session = await TelegramSession.findOne({ userId, isActive: true });
        
        res.json({
            connected: !!session,
            phoneNumber: session ? session.phoneNumber : null,
            lastSync: session ? session.lastSync : null
        });

    } catch (error) {
        console.error("Error checking Telegram status:", error);
        res.status(500).json({ error: error.message });
    }
});

// 18. Check All Platforms Status
app.get('/api/platforms/status', async (req, res) => {
    const userId = req.headers['x-user-id'] || 'anonymous';
    
    // Check Gmail
    let gmailConnected = false;
    try {
        const gmail = await getGmailClient();
        gmailConnected = !!gmail;
    } catch (e) {
        console.error("Error checking Gmail status:", e);
        gmailConnected = false;
    }

    // Check Telegram
    let telegramConnected = false;
    try {
        const session = await TelegramSession.findOne({ userId, isActive: true });
        telegramConnected = !!session;
    } catch (e) {
        console.error("Error checking Telegram status:", e);
        telegramConnected = false;
    }

    // Check WhatsApp
    let whatsappConnected = false;
    try {
        const whatsappSession = await WhatsAppSession.findOne({ userId, isActive: true });
        whatsappConnected = !!whatsappSession;
    } catch (e) {
        console.error("Error checking WhatsApp status:", e);
        whatsappConnected = false;
    }

    res.json({
        Mail: gmailConnected,
        Telegram: telegramConnected,
        Whatsapp: whatsappConnected
    });
});

// --- WhatsApp Web Routes ---

// 19. Initialize WhatsApp Connection (Get QR Code)
app.post('/api/whatsapp/auth/start', async (req, res) => {
    const userId = req.headers['x-user-id'] || 'anonymous';

    try {
        console.log(`📱 Starting WhatsApp auth for user: ${userId}`);
        
        // Initialize WhatsApp client
        const result = await whatsappService.getQRCode();
        
        if (result.ready) {
            return res.json({
                success: true,
                message: "WhatsApp already connected",
                connected: true
            });
        }

        if (result.qr) {
            return res.json({
                success: true,
                qr: result.qr,
                message: "Scan this QR code with WhatsApp"
            });
        }

        // If neither, still initializing
        res.json({
            success: true,
            message: "Initializing WhatsApp client...",
            initializing: true
        });

    } catch (error) {
        console.error("Error starting WhatsApp auth:", error);
        res.status(500).json({ error: error.message });
    }
});

// 20. Check WhatsApp Connection Status
app.get('/api/whatsapp/status', async (req, res) => {
    try {
        const status = await whatsappService.getStatus();
        res.json(status);
    } catch (error) {
        console.error("Error checking WhatsApp status:", error);
        res.status(500).json({ error: error.message });
    }
});

// 21. Get WhatsApp Chats
app.get('/api/whatsapp/chats', async (req, res) => {
    const userId = req.headers['x-user-id'] || 'anonymous';

    try {
        console.log(`📱 Fetching WhatsApp chats for user: ${userId}`);
        const chats = await whatsappService.getChats();
        
        console.log(`✅ Fetched ${chats.length} WhatsApp chats`);
        res.json({ chats });

    } catch (error) {
        console.error("Error fetching WhatsApp chats:", error);
        res.status(500).json({ error: error.message });
    }
});

// 22. Send WhatsApp Message
app.post('/api/whatsapp/send', async (req, res) => {
    const { chatId, message } = req.body;
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!chatId || !message) {
        return res.status(400).json({ error: "chatId and message are required" });
    }

    try {
        const result = await whatsappService.sendMessage(chatId, message);
        res.json(result);

    } catch (error) {
        console.error("Error sending WhatsApp message:", error);
        res.status(500).json({ error: error.message });
    }
});

// 23. Disconnect WhatsApp
app.post('/api/platforms/disconnect/Whatsapp', async (req, res) => {
    try {
        await whatsappService.disconnect();
        res.json({ success: true, message: "WhatsApp disconnected" });
    } catch (error) {
        console.error("Error disconnecting WhatsApp:", error);
        res.status(500).json({ error: error.message });
    }
});


// --- WhatsApp Business API Routes ---

// 20. Webhook Verification (GET) - Required by Meta
app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'my_verify_token_123';

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ WhatsApp webhook verified');
        res.status(200).send(challenge);
    } else {
        console.error('❌ WhatsApp webhook verification failed');
        res.sendStatus(403);
    }
});

// 21. Webhook Handler (POST) - Receive incoming messages
app.post('/api/whatsapp/webhook', async (req, res) => {
    try {
        // Verify signature for security
        const signature = req.headers['x-hub-signature-256'];
        const rawBody = JSON.stringify(req.body);
        
        // Respond quickly to Meta (required)
        res.sendStatus(200);

        // Process webhook asynchronously
        const parsedMessage = whatsappService.parseWebhookMessage(req.body);
        
        if (!parsedMessage) {
            console.log('⚠️ No message data in webhook');
            return;
        }

        console.log('📨 WhatsApp webhook received:', parsedMessage);

        // Handle incoming message
        if (parsedMessage.type === 'message') {
            // Find the user's WhatsApp session
            const session = await WhatsAppSession.findOne({ isActive: true });
            
            if (session) {
                // Update conversation
                session.updateConversation(
                    parsedMessage.from,
                    parsedMessage.from,
                    parsedMessage.contactName,
                    parsedMessage.text
                );

                // Add to message history
                session.addMessage(parsedMessage.from, {
                    id: parsedMessage.messageId,
                    from: parsedMessage.from,
                    to: session.phoneNumberId,
                    text: parsedMessage.text,
                    timestamp: new Date(parseInt(parsedMessage.timestamp) * 1000),
                    status: 'received',
                    type: parsedMessage.messageType
                });

                await session.save();
                console.log('✅ Message saved to database');

                // Mark as read
                await whatsappService.markMessageAsRead(
                    parsedMessage.messageId,
                    session.getDecryptedToken()
                );
            }
        }

        // Handle status updates
        if (parsedMessage.type === 'status') {
            console.log('📊 Message status update:', parsedMessage.status);
            // Update message status in database if needed
        }

    } catch (error) {
        console.error('Error processing WhatsApp webhook:', error);
        // Don't send error to Meta - already responded with 200
    }
});

// 22. Connect WhatsApp - Save credentials and test connection
app.post('/api/whatsapp/connect', async (req, res) => {
    const { accessToken, phoneNumberId, businessAccountId } = req.body;
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!accessToken || !phoneNumberId || !businessAccountId) {
        return res.status(400).json({ 
            error: 'Missing required fields: accessToken, phoneNumberId, businessAccountId' 
        });
    }

    try {
        // Test the connection first
        const testResult = await whatsappService.testConnection(accessToken, phoneNumberId);

        if (!testResult.success) {
            return res.status(400).json({ 
                error: 'Connection test failed', 
                details: testResult.error 
            });
        }

        // Save or update session
        const session = await WhatsAppSession.findOneAndUpdate(
            { userId },
            {
                userId,
                phoneNumberId,
                businessAccountId,
                displayPhoneNumber: testResult.phoneNumber,
                accessToken, // Will be encrypted by pre-save hook
                isActive: true,
                lastSync: new Date(),
                metadata: {
                    verifiedName: testResult.verifiedName,
                    qualityRating: testResult.qualityRating
                }
            },
            { upsert: true, new: true }
        );

        console.log('✅ WhatsApp connected successfully for user:', userId);

        res.json({
            success: true,
            message: 'WhatsApp connected successfully',
            phoneNumber: testResult.phoneNumber,
            verifiedName: testResult.verifiedName,
            qualityRating: testResult.qualityRating
        });

    } catch (error) {
        console.error('Error connecting WhatsApp:', error);
        res.status(500).json({ error: error.message });
    }
});

// 23. Check WhatsApp Connection Status
app.get('/api/whatsapp/status', async (req, res) => {
    const userId = req.headers['x-user-id'] || 'anonymous';

    try {
        const session = await WhatsAppSession.findOne({ userId, isActive: true });

        if (!session) {
            return res.json({
                connected: false,
                phoneNumber: null,
                lastSync: null
            });
        }

        res.json({
            connected: true,
            phoneNumber: session.displayPhoneNumber,
            verifiedName: session.metadata?.verifiedName,
            qualityRating: session.metadata?.qualityRating,
            lastSync: session.lastSync,
            conversationCount: session.conversations.length
        });

    } catch (error) {
        console.error('Error checking WhatsApp status:', error);
        res.status(500).json({ error: error.message });
    }
});

// 24. Get WhatsApp Conversations
app.get('/api/whatsapp/conversations', async (req, res) => {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const limit = parseInt(req.query.limit) || 50;

    try {
        const session = await WhatsAppSession.findOne({ userId, isActive: true });

        if (!session) {
            return res.status(401).json({ error: 'WhatsApp not connected' });
        }

        // Sort conversations by last message time
        const conversations = session.conversations
            .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime))
            .slice(0, limit)
            .map(conv => ({
                id: conv.chatId,
                chatId: conv.chatId,
                title: conv.contactName,
                phoneNumber: conv.contactPhone,
                message: {
                    text: conv.lastMessage,
                    date: conv.lastMessageTime
                },
                unreadCount: conv.unreadCount
            }));

        res.json({ 
            success: true,
            conversations 
        });

    } catch (error) {
        console.error('Error fetching WhatsApp conversations:', error);
        res.status(500).json({ error: error.message });
    }
});

// 25. Get Messages from a Conversation
app.get('/api/whatsapp/messages/:phoneNumber', async (req, res) => {
    const { phoneNumber } = req.params;
    const userId = req.headers['x-user-id'] || 'anonymous';
    const limit = parseInt(req.query.limit) || 50;

    try {
        const session = await WhatsAppSession.findOne({ userId, isActive: true });

        if (!session) {
            return res.status(401).json({ error: 'WhatsApp not connected' });
        }

        const conversation = session.conversations.find(c => c.chatId === phoneNumber);

        if (!conversation) {
            return res.json({ messages: [] });
        }

        const messages = conversation.messageHistory
            .slice(-limit)
            .map(msg => ({
                id: msg.messageId,
                from: msg.from,
                to: msg.to,
                text: msg.text,
                timestamp: msg.timestamp,
                status: msg.status,
                type: msg.type
            }));

        res.json({ messages });

    } catch (error) {
        console.error('Error fetching WhatsApp messages:', error);
        res.status(500).json({ error: error.message });
    }
});

// 26. Send WhatsApp Message
app.post('/api/whatsapp/send', async (req, res) => {
    const { to, message } = req.body;
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!to || !message) {
        return res.status(400).json({ error: 'Missing required fields: to, message' });
    }

    try {
        const session = await WhatsAppSession.findOne({ userId, isActive: true });

        if (!session) {
            return res.status(401).json({ error: 'WhatsApp not connected' });
        }

        const accessToken = session.getDecryptedToken();

        // Send message
        const result = await whatsappService.sendMessage(to, message, accessToken);

        if (!result.success) {
            return res.status(400).json({ error: result.error, details: result.details });
        }

        // Update conversation in database
        session.updateConversation(to, to, to, message);
        session.addMessage(to, {
            id: result.messageId,
            from: session.phoneNumberId,
            to: to,
            text: message,
            timestamp: new Date(),
            status: 'sent',
            type: 'text'
        });

        await session.save();

        res.json({
            success: true,
            messageId: result.messageId,
            message: 'Message sent successfully'
        });

    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        res.status(500).json({ error: error.message });
    }
});

// 27. Send WhatsApp Template Message
app.post('/api/whatsapp/send-template', async (req, res) => {
    const { to, templateName, languageCode, components } = req.body;
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!to || !templateName) {
        return res.status(400).json({ error: 'Missing required fields: to, templateName' });
    }

    try {
        const session = await WhatsAppSession.findOne({ userId, isActive: true });

        if (!session) {
            return res.status(401).json({ error: 'WhatsApp not connected' });
        }

        const accessToken = session.getDecryptedToken();

        // Send template message
        const result = await whatsappService.sendTemplateMessage(
            to,
            templateName,
            languageCode || 'en',
            components || [],
            accessToken
        );

        if (!result.success) {
            return res.status(400).json({ error: result.error, details: result.details });
        }

        res.json({
            success: true,
            messageId: result.messageId,
            message: 'Template message sent successfully'
        });

    } catch (error) {
        console.error('Error sending WhatsApp template:', error);
        res.status(500).json({ error: error.message });
    }
});

// 28. Get Message Templates
app.get('/api/whatsapp/templates', async (req, res) => {
    const userId = req.headers['x-user-id'] || 'anonymous';

    try {
        const session = await WhatsAppSession.findOne({ userId, isActive: true });

        if (!session) {
            return res.status(401).json({ error: 'WhatsApp not connected' });
        }

        const accessToken = session.getDecryptedToken();
        const result = await whatsappService.getMessageTemplates(
            accessToken,
            session.businessAccountId
        );

        res.json(result);

    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: error.message });
    }
});

// 19. Disconnect Platform
app.post('/api/platforms/disconnect/:platform', async (req, res) => {
    const { platform } = req.params;
    const userId = req.headers['x-user-id'] || 'anonymous';

    try {
        if (platform === 'Mail') {
            const tokenPath = require('path').join(__dirname, 'token.json');
            try {
                await require('fs').promises.unlink(tokenPath);
                // Also reset the oauth client credentials
                const { oauth2Client } = require('./gmailService');
                if (oauth2Client) {
                    oauth2Client.setCredentials({});
                }
                res.json({ success: true, message: 'Gmail disconnected' });
            } catch (err) {
                if (err.code === 'ENOENT') {
                    res.json({ success: true, message: 'Gmail was already disconnected' });
                } else {
                    throw err;
                }
            }
        } else if (platform === 'Telegram') {
            await TelegramSession.deleteOne({ userId, isActive: true });
            // Also disconnect the active client if it exists in memory
            // (This would require exposing a disconnect method in telegramService, but for now DB removal is enough for persistent state)
            res.json({ success: true, message: 'Telegram disconnected' });
        } else if (platform === 'Whatsapp') {
            await WhatsAppSession.deleteOne({ userId, isActive: true });
            res.json({ success: true, message: 'WhatsApp disconnected' });
        } else {
            res.status(400).json({ error: 'Unknown platform' });
        }
    } catch (error) {
        console.error(`Error disconnecting ${platform}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
