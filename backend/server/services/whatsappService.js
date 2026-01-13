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
                    '--disable-gpu'
                ]
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

        await this.client.initialize();
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
    }

    async sendMessage(chatId, message) {
        if (!this.isReady) {
            throw new Error('WhatsApp not connected');
        }

        await this.client.sendMessage(chatId, message);
        return { success: true };
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
