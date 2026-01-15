const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');

class WhatsAppService {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.qrCode = null;
        this.authCallbacks = [];
        this.sessionPath = path.join(__dirname, '..', '.wwebjs_auth');
    }

    async initialize() {
        if (this.client) {
            console.log('WhatsApp client already initialized');
            return;
        }

        console.log('Initializing WhatsApp client...');

        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: this.sessionPath
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--remote-debugging-port=9222'
                ],
                executablePath: process.env.CHROME_PATH || undefined // Allow overriding chrome path
            },
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
            }
        });

        // QR Code event
        this.client.on('qr', (qr) => {
            console.log('QR Code received');
            this.qrCode = qr;
            // Notify all waiting callbacks
            this.authCallbacks.forEach(callback => callback({ qr }));
        });

        // Ready event
        this.client.on('ready', () => {
            console.log('WhatsApp client is ready!');
            this.isReady = true;
            this.qrCode = null;
            this.authCallbacks.forEach(callback => callback({ ready: true }));
            this.authCallbacks = [];
        });

        // Authenticated event
        this.client.on('authenticated', () => {
            console.log('WhatsApp authenticated');
        });

        // Auth failure event
        this.client.on('auth_failure', (msg) => {
            console.error('WhatsApp authentication failed:', msg);
            this.authCallbacks.forEach(callback => callback({ error: msg }));
            this.authCallbacks = [];
        });

        // Disconnected event
        this.client.on('disconnected', (reason) => {
            console.log('WhatsApp disconnected:', reason);
            this.isReady = false;
            this.client = null;
        });

        // Message event
        this.client.on('message', async (message) => {
            console.log('New WhatsApp message:', message.from, message.body);
        });

        try {
            await this.client.initialize();
            console.log('✅ WhatsApp client.initialize() completed');
        } catch (error) {
            console.error('❌ Failed to initialize WhatsApp client:', error);
            this.client = null;
            this.isReady = false;
            this.qrCode = null;
            // Notify waiting callbacks of the error
            this.authCallbacks.forEach(callback => callback({ error: error.message }));
            this.authCallbacks = [];
        }
    }

    async getQRCode() {
        return new Promise((resolve) => {
            if (this.isReady) {
                resolve({ ready: true });
                return;
            }

            if (this.qrCode) {
                resolve({ qr: this.qrCode });
                return;
            }

            // Wait for QR or ready event
            this.authCallbacks.push(resolve);

            // Initialize if not already done
            if (!this.client) {
                this.initialize();
            }
        });
    }

    async getStatus() {
        return {
            connected: this.isReady,
            hasClient: !!this.client
        };
    }

    async getChats() {
        if (!this.isReady) {
            throw new Error('WhatsApp not connected');
        }

        try {
            const chats = await this.client.getChats();
            
            return chats.slice(0, 50).map(chat => ({
                id: chat.id._serialized,
                name: chat.name || chat.id.user,
                isGroup: chat.isGroup,
                unreadCount: chat.unreadCount,
                lastMessage: chat.lastMessage ? {
                    body: chat.lastMessage.body,
                    timestamp: chat.lastMessage.timestamp,
                    fromMe: chat.lastMessage.fromMe
                } : null
            }));
        } catch (error) {
            console.error('❌ Error in getChats:', error);
            if (error.message.includes('detached Frame') || error.message.includes('Session closed') || error.message.includes('Target closed')) {
                console.log('🔄 WhatsApp session unstable, attempting auto-recovery...');
                this.isReady = false;
                this.qrCode = null;
                
                // Attempt to re-initialize after a short delay
                setTimeout(async () => {
                    console.log('🚀 Re-initializing WhatsApp client for recovery...');
                    try {
                        if (this.client) {
                            await this.client.destroy().catch(() => {});
                        }
                    } catch (e) {}
                    this.client = null; // Force new client creation
                    this.initialize().catch(err => console.error('Recovery initialization failed:', err));
                }, 2000);
            }
            throw error;
        }
    }

    async sendMessage(chatId, message) {
        if (!this.isReady) {
            throw new Error('WhatsApp not connected');
        }

        await this.client.sendMessage(chatId, message);
        return { success: true };
    }


    async getChatMessages(chatId, limit = 50) {
        if (!this.isReady) {
            throw new Error('WhatsApp not connected');
        }

        try {
            console.log(`📱 Fetching messages for chat: ${chatId}, limit: ${limit}`);
            const chat = await this.client.getChatById(chatId);
            
            // Fetch messages from the chat
            let messages = await chat.fetchMessages({ limit: limit });
            
            console.log(`✅ Fetched ${messages.length} raw messages from WhatsApp`);
            
            if (!messages || messages.length === 0) {
                console.log('⚠️ No messages found in chat');
                return [];
            }
            
            // Format and reverse to show oldest first
            const formattedMessages = messages.reverse().map((msg, index) => {
                console.log(`Message ${index}: ${msg.body?.substring(0, 50)}... fromMe: ${msg.fromMe}`);
                return {
                    id: msg.id._serialized,
                    body: msg.body || '',
                    timestamp: msg.timestamp,
                    fromMe: msg.fromMe,
                    author: msg.author || '',
                    type: msg.type
                };
            });
            
            console.log(`✅ Returning ${formattedMessages.length} formatted messages`);
            return formattedMessages;
        } catch (error) {
            console.error('❌ Error fetching chat messages:', error);
            throw error;
        }
    }




    async disconnect() {
        if (this.client) {
            await this.client.destroy();
            this.client = null;
            this.isReady = false;
            this.qrCode = null;
        }
    }
}

// Singleton instance
const whatsappService = new WhatsAppService();

module.exports = whatsappService;
