const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');

class WhatsAppService {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.qrCode = null;
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
        });

        // Ready event
        this.client.on('ready', () => {
            console.log('WhatsApp client is ready!');
            this.isReady = true;
            this.qrCode = null;
        });

        // Authenticated event
        this.client.on('authenticated', () => {
            console.log('WhatsApp authenticated');
        });

        // Auth failure event
        this.client.on('auth_failure', (msg) => {
            console.error('WhatsApp authentication failed:', msg);
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
            this.isReady = false;
            this.qrCode = null;
        }
    }

    async getQRCode() {
        if (this.isReady) {
            return { ready: true };
        }

        if (this.qrCode) {
            return { qr: this.qrCode };
        }

        // Initialize if not already done
        if (!this.client) {
            this.initialize();
        }

        // Return initializing status so frontend handles polling
        return { initializing: true };
    }

    async getStatus() {
        return {
            connected: this.isReady,
            hasClient: !!this.client,
            qrGenerated: !!this.qrCode
        };
    }

    async getChats() {
        if (!this.isReady) {
            throw new Error('WhatsApp not connected');
        }

        try {
            const chats = await this.client.getChats();
            
            // Sort chats by most recent message first for the sidebar list
            return chats
                .sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0))
                .slice(0, 50)
                .map(chat => ({
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

        try {
            // The 'markedUnread' error often happens when WhatsApp Web tries to mark as seen automatically.
            // We'll try with sendSeen: false to avoid that internal JS crash in WhatsApp Web.
            await this.client.sendMessage(chatId, message, { sendSeen: false });
            return { success: true };
        } catch (error) {
            console.error('❌ WhatsApp primary sendMessage failed:', error.message);
            
            // Fallback: If it's the internal WhatsApp Web JS error, try fetching the chat object first
            if (error.message.includes('markedUnread') || error.message.includes('undefined')) {
                console.log('🔄 Attempting fallback message delivery...');
                try {
                    const chat = await this.client.getChatById(chatId);
                    await chat.sendMessage(message);
                    return { success: true };
                } catch (fallbackError) {
                    console.error('❌ Fallback delivery also failed:', fallbackError.message);
                    throw fallbackError;
                }
            }
            throw error;
        }
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
            
            // Format messages - typically fetchMessages returns them in chronological order
            const formattedMessages = messages.map((msg, index) => {
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
        console.log('🗑️ Disconnecting WhatsApp and clearing session files...');
        try {
            if (this.client) {
                try {
                    // Try to logout first if possible to invalidate session on server
                    await this.client.logout().catch(() => {});
                    await this.client.destroy();
                } catch (e) {
                    console.warn('Warning during client destroy:', e.message);
                }
                this.client = null;
            }
            this.isReady = false;
            this.qrCode = null;

            // Wait a bit for browser processes to fully exit before deleting files (critical on Windows)
            await new Promise(resolve => setTimeout(resolve, 2000));

            const fs = require('fs');
            const deleteFolderRecursive = (folderPath, retries = 3) => {
                if (fs.existsSync(folderPath)) {
                    for (let i = 0; i < retries; i++) {
                        try {
                            fs.rmSync(folderPath, { recursive: true, force: true });
                            console.log(`✅ Folder cleared: ${folderPath}`);
                            return true;
                        } catch (err) {
                            if (i === retries - 1) console.error(`Failed to delete ${folderPath}:`, err.message);
                            else {
                                console.log(`Retry ${i + 1} deleting ${folderPath}...`);
                                // Sleep for 1 second before retry
                                // Note: we are using sync sleep here since rmSync is sync, 
                                // or just use a small delay if possible.
                            }
                        }
                    }
                }
                return false;
            };

            deleteFolderRecursive(this.sessionPath);
            
            const cachePath = path.join(__dirname, '..', '.wwebjs_cache');
            deleteFolderRecursive(cachePath);

        } catch (error) {
            console.error('Error during WhatsApp disconnect:', error);
        }
    }
}

// Singleton instance
const whatsappService = new WhatsAppService();

module.exports = whatsappService;
