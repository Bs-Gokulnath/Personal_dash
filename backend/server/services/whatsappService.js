const path = require('path');
const fs = require('fs');

// Silent logger
const logger = {
    level: 'silent',
    trace: () => {}, debug: () => {}, info: () => {},
    warn: () => {}, error: () => {}, fatal: () => {},
    child: () => logger,
};

const getTs = (ts) => {
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'bigint') return Number(ts);
    if (ts && typeof ts.toNumber === 'function') return ts.toNumber();
    if (ts && ts.low !== undefined) return ts.low;
    return 0;
};

const getMsgText = (msg) =>
    msg?.message?.conversation
    || msg?.message?.extendedTextMessage?.text
    || msg?.message?.imageMessage?.caption
    || msg?.message?.videoMessage?.caption
    || msg?.message?.documentMessage?.caption
    || (msg?.message ? '[media]' : '');

class WhatsAppService {
    constructor() {
        this.sock = null;
        this.isReady = false;
        this.qrRaw = null;
        this.isInitializing = false;
        this.initError = null;
        this.authDir = path.join(__dirname, '..', 'baileys_auth');
        this.chatsFile = path.join(__dirname, '..', 'baileys_auth', 'cached_chats.json');

        // In-memory caches
        this._chats = new Map();
        this._messages = new Map();
        this._contacts = new Map(); // jid -> { name, notify }
        this.contactsFile = path.join(__dirname, '..', 'baileys_auth', 'cached_contacts.json');

        // Load persisted data immediately
        this._loadPersistedChats();
        this._loadPersistedContacts();

        this._listeners = {};
    }

    // ── Persist / Load chats ─────────────────────────────────────────────────
    _loadPersistedChats() {
        try {
            if (fs.existsSync(this.chatsFile)) {
                const data = JSON.parse(fs.readFileSync(this.chatsFile, 'utf8'));
                for (const c of (data || [])) this._chats.set(c.id, c);
                console.log(`📋 Loaded ${this._chats.size} persisted chats from disk`);
            }
        } catch (e) {
            console.log('Could not load persisted chats:', e.message);
        }
    }

    _persistChats() {
        try {
            if (!fs.existsSync(this.authDir)) return;
            fs.writeFileSync(this.chatsFile, JSON.stringify([...this._chats.values()]), 'utf8');
        } catch (e) {}
    }

    _loadPersistedContacts() {
        try {
            if (fs.existsSync(this.contactsFile)) {
                const data = JSON.parse(fs.readFileSync(this.contactsFile, 'utf8'));
                for (const c of (data || [])) {
                    if (c.id) this._contacts.set(c.id, c);
                    if (c.lid) this._contacts.set(c.lid, c); // index by LID too (@lid JIDs)
                }
                console.log(`👤 Loaded ${this._contacts.size} persisted contacts from disk`);
            }
        } catch (e) {}
    }

    _persistContacts() {
        try {
            if (!fs.existsSync(this.authDir)) return;
            fs.writeFileSync(this.contactsFile, JSON.stringify([...this._contacts.values()]), 'utf8');
        } catch (e) {}
    }

    // Best name for a JID: saved contact > pushName > chat name (if real name) > phone number
    _resolveName(jid, pushName, chatName) {
        const contact = this._contacts.get(jid);
        if (contact?.name) return contact.name;
        if (contact?.notify) return contact.notify;
        if (pushName && !this._isPhoneNumber(pushName)) return pushName;
        // Use chat.name if it looks like a real name (not just digits)
        if (chatName && !this._isPhoneNumber(chatName)) return chatName;
        if (pushName) return pushName; // fallback: even if numeric pushName, better than nothing
        return jid?.split('@')[0] || jid;
    }

    // Returns true if the string is purely numeric (a raw phone number, not a real name)
    _isPhoneNumber(str) {
        if (!str) return false;
        return /^\+?\d[\d\s\-().]{4,}$/.test(str.trim());
    }

    // ── EventEmitter ─────────────────────────────────────────────────────────
    on(event, cb) { (this._listeners[event] = this._listeners[event] || []).push(cb); return this; }
    off(event, cb) { if (this._listeners[event]) this._listeners[event] = this._listeners[event].filter(l => l !== cb); }
    _emit(event, data) { (this._listeners[event] || []).forEach(cb => { try { cb(data); } catch {} }); }

    // ── Initialize ───────────────────────────────────────────────────────────
    async initialize() {
        if (this.isInitializing || this.isReady) return;
        this.isInitializing = true;
        this.initError = null;
        this._messages.clear();
        // NOTE: don't clear _chats here — keep persisted data during reconnect

        try {
            const {
                default: makeWASocket,
                useMultiFileAuthState,
                DisconnectReason,
                fetchLatestBaileysVersion,
                makeCacheableSignalKeyStore,
                downloadAndProcessHistorySyncNotification,
            } = await import('@whiskeysockets/baileys');

            if (!fs.existsSync(this.authDir)) fs.mkdirSync(this.authDir, { recursive: true });

            let version = [2, 3000, 1015901307];
            try { const v = await fetchLatestBaileysVersion(); version = v.version; } catch {}
            console.log(`📱 Baileys v7 using WA version: ${version.join('.')}`);

            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

            this.sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger),
                },
                printQRInTerminal: false,
                logger,
                browser: ['Crivo Inai', 'Chrome', '3.0.0'],
                syncFullHistory: false,
                generateHighQualityLinkPreview: false,
                getMessage: async (key) => {
                    const msgs = this._messages.get(key.remoteJid) || [];
                    return msgs.find(m => m.key?.id === key.id)?.message;
                },
            });

            this.sock.ev.on('creds.update', saveCreds);

            // ── Connection ───────────────────────────────────────────────────
            this.sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
                if (qr) {
                    console.log('✅ QR received (Baileys v7)');
                    this.qrRaw = qr;
                    this.isInitializing = false;
                    this._emit('qr', qr);
                }

                if (connection === 'open') {
                    console.log('✅ WhatsApp connected via Baileys v7!');
                    this.isReady = true;
                    this.isInitializing = false;
                    this.qrRaw = null;
                    this._emit('ready');

                    // Emit persisted chats immediately on reconnect
                    if (this._chats.size > 0) {
                        console.log(`📋 Emitting ${this._chats.size} persisted chats on reconnect`);
                        setTimeout(() => this._emit('chats', this._getFormattedChats()), 500);
                    }

                    // Force app-state resync + on-demand history for unresolved chats
                    setTimeout(async () => {
                        try {
                            if (!this.sock || !this.isReady) return;

                            // 1. App-state resync for saved contact names
                            try {
                                console.log('🔄 Requesting contacts app-state resync...');
                                await this.sock.resyncAppState(
                                    ['regular_high', 'regular_low', 'regular', 'critical_block', 'critical_unblock_low'],
                                    true
                                );
                                console.log('✅ resyncAppState sent');
                            } catch (e) {
                                console.log('resyncAppState note:', e.message);
                            }

                            // 2. Fetch on-demand history for @lid chats with no resolved name
                            // This triggers messaging-history.set with contacts containing the name
                            await new Promise(r => setTimeout(r, 3000)); // wait for app-state to settle
                            if (!this.sock || !this.isReady) return;

                            const unresolvedChats = [...this._chats.values()].filter(c => {
                                if (!c.id || c.id.endsWith('@g.us') || c.id === '0@s.whatsapp.net') return false;
                                const name = this._resolveName(c.id, null, c.name);
                                return this._isPhoneNumber(name) || name === c.id?.split('@')[0];
                            });

                            if (unresolvedChats.length > 0) {
                                console.log(`🔍 Requesting history for ${unresolvedChats.length} unresolved chats...`);
                                for (const chat of unresolvedChats.slice(0, 15)) {
                                    try {
                                        // Use a fake old message key to trigger history fetch
                                        const fakeKey = {
                                            remoteJid: chat.id,
                                            fromMe: false,
                                            id: 'AAAA'
                                        };
                                        await this.sock.fetchMessageHistory(5, fakeKey, Date.now() - 86400000);
                                        await new Promise(r => setTimeout(r, 500)); // rate limit
                                    } catch (e) { /* ignore per-chat errors */ }
                                }
                            }
                        } catch (e) {
                            console.log('post-connect sync error (non-fatal):', e.message);
                        }
                    }, 2000);
                }

                if (connection === 'close') {
                    const code = lastDisconnect?.error?.output?.statusCode;
                    this.isReady = false;
                    console.log(`WhatsApp closed (code: ${code})`);

                    if (code === DisconnectReason.loggedOut) {
                        this._clearAuth();
                        this.sock = null;
                        this.isInitializing = false;
                        this._chats.clear();
                        this._emit('disconnected', 'loggedOut');
                    } else {
                        this.sock = null;
                        this.isInitializing = false;
                        setTimeout(() => this.initialize(), 4000);
                    }
                }
            });

            // ── Contacts ─────────────────────────────────────────────────────
            this.sock.ev.on('contacts.upsert', (contacts) => {
                let added = 0;
                for (const c of (contacts || [])) {
                    if (!c.id) continue;
                    const existing = this._contacts.get(c.id) || {};
                    const merged = { ...existing, ...c };
                    if (!merged.name && existing.name) merged.name = existing.name;
                    this._contacts.set(c.id, merged);
                    if (c.lid) this._contacts.set(c.lid, merged); // also index by @lid JID
                    if (c.name || c.notify) added++;
                }
                console.log(`👤 contacts.upsert: ${contacts?.length} total, ${added} with names`);
                this._persistContacts();
                this._emit('chats', this._getFormattedChats()); // re-emit with resolved names
            });

            this.sock.ev.on('contacts.update', (updates) => {
                for (const u of (updates || [])) {
                    if (!u.id) continue;
                    const existing = this._contacts.get(u.id) || {};
                    const merged = { ...existing, ...u };
                    this._contacts.set(u.id, merged);
                    if (u.lid) this._contacts.set(u.lid, merged);
                }
                this._persistContacts();
                this._emit('chats', this._getFormattedChats());
            });

            // ── History sync (fires on first/fresh connection) ────────────────
            this.sock.ev.on('messaging-history.set', ({ chats, messages, contacts }) => {
                const chatArr = chats || [];
                const msgArr = messages || [];
                const contactArr = Array.isArray(contacts) ? contacts : Object.entries(contacts || {}).map(([id, c]) => ({ id, ...c }));
                console.log(`📋 messaging-history.set: ${chatArr.length} chats, ${msgArr.length} msgs, ${contactArr.length} contacts`);

                for (const c of chatArr) this._chats.set(c.id, c);
                for (const msg of msgArr) {
                    const jid = msg.key?.remoteJid;
                    if (!jid) continue;
                    if (!this._messages.has(jid)) this._messages.set(jid, []);
                    const arr = this._messages.get(jid);
                    if (!arr.some(m => m.key?.id === msg.key?.id)) arr.push(msg);
                }
                // Store contacts from history sync — index by id, lid, AND phoneNumber
                for (const c of contactArr) {
                    if (!c.id) continue;
                    const existing = this._contacts.get(c.id) || {};
                    const merged = { ...existing, ...c };
                    this._contacts.set(c.id, merged);
                    if (c.lid) this._contacts.set(c.lid, merged);
                    if (c.phoneNumber) {
                        const pnEx = this._contacts.get(c.phoneNumber) || {};
                        this._contacts.set(c.phoneNumber, { ...pnEx, ...c });
                    }
                }

                this._persistChats();
                this._persistContacts();
                this._emit('chats', this._getFormattedChats());
            });

            // ── Chats (v7 primary: chats.upsert fires instead of chats.set) ──
            this.sock.ev.on('chats.upsert', (newChats) => {
                const arr = Array.isArray(newChats) ? newChats : [];
                console.log(`📋 chats.upsert: ${arr.length} chats`);
                for (const c of arr) this._chats.set(c.id, c);
                this._persistChats();
                this._emit('chats', this._getFormattedChats());
            });

            this.sock.ev.on('chats.update', (updates) => {
                for (const u of updates) {
                    const existing = this._chats.get(u.id) || {};
                    this._chats.set(u.id, { ...existing, ...u });
                }
                this._persistChats();
                this._emit('chats', this._getFormattedChats());
            });

            this.sock.ev.on('chats.set', ({ chats }) => {
                console.log(`📋 chats.set: ${chats?.length} chats`);
                for (const c of (chats || [])) this._chats.set(c.id, c);
                this._persistChats();
                this._emit('chats', this._getFormattedChats());
            });

            // ── Messages ─────────────────────────────────────────────────────
            this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
                for (const msg of messages) {
                    const jid = msg.key?.remoteJid;
                    if (!jid) continue;

                    // Baileys v7: handle history sync notification in messages
                    if (msg.message?.protocolMessage?.historySyncNotification) {
                        try {
                            const { chats: histChats, messages: histMsgs, contacts: histContacts } =
                                await downloadAndProcessHistorySyncNotification(
                                    msg.message.protocolMessage.historySyncNotification,
                                    {}
                                );
                            console.log(`📋 historySync via message: ${histChats?.length || 0} chats, ${histContacts?.length || 0} contacts`);

                            // Store contacts (includes @lid → name mappings!)
                            for (const c of (histContacts || [])) {
                                if (!c.id) continue;
                                const existing = this._contacts.get(c.id) || {};
                                const merged = { ...existing, ...c };
                                this._contacts.set(c.id, merged);
                                if (c.lid) this._contacts.set(c.lid, merged);
                                if (c.phoneNumber) {
                                    const pnExisting = this._contacts.get(c.phoneNumber) || {};
                                    this._contacts.set(c.phoneNumber, { ...pnExisting, ...c });
                                }
                            }

                            for (const c of (histChats || [])) this._chats.set(c.id, c);
                            for (const m of (histMsgs || [])) {
                                const mjid = m.key?.remoteJid;
                                if (!mjid) continue;
                                if (!this._messages.has(mjid)) this._messages.set(mjid, []);
                                const arr = this._messages.get(mjid);
                                if (!arr.some(x => x.key?.id === m.key?.id)) arr.push(m);
                            }
                            this._persistChats();
                            this._persistContacts();
                            this._emit('chats', this._getFormattedChats());
                        } catch (e) {
                            console.log('historySync download error:', e.message);
                        }
                        continue;
                    }

                    if (!this._messages.has(jid)) this._messages.set(jid, []);
                    const arr = this._messages.get(jid);
                    if (!arr.some(m => m.key?.id === msg.key?.id)) arr.push(msg);

                    // Capture pushName from ANY incoming message (not just new chats)
                    // This is a reliable fallback since contacts.upsert doesn't fire on reconnect
                    if (msg.pushName && !msg.key?.fromMe) {
                        const existing = this._contacts.get(jid) || {};
                        // Only update if we don't have a real name yet
                        if (!existing.name && !existing.notify) {
                            this._contacts.set(jid, { ...existing, id: jid, notify: msg.pushName });
                        }
                    }

                    // Update chat timestamp
                    const chat = this._chats.get(jid);
                    if (chat) {
                        this._chats.set(jid, { ...chat, conversationTimestamp: getTs(msg.messageTimestamp) });
                    } else {
                        // New chat not in our list — add it
                        this._chats.set(jid, {
                            id: jid,
                            name: msg.pushName || this._resolveName(jid, null, null),
                            conversationTimestamp: getTs(msg.messageTimestamp),
                            unreadCount: 0,
                        });
                    }
                }

                if (type === 'notify') {
                    for (const msg of messages) {
                        // Only emit incoming messages — frontend handles sent (fromMe) with optimistic UI
                        if (msg.key?.remoteJid && !msg.message?.protocolMessage && !msg.key?.fromMe) {
                            this._emit('message', this._fmtMsg(msg));
                        }
                    }
                    this._persistChats();
                    this._emit('chats', this._getFormattedChats());
                }
            });

        } catch (err) {
            console.error('❌ Baileys init failed:', err.message);
            this.initError = err.message;
            this.isInitializing = false;
            this.sock = null;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    _getFormattedChats() {
        return [...this._chats.values()]
            .filter(c => c.id && !c.id.endsWith('@broadcast') && !c.id.endsWith('@newsletter'))
            .sort((a, b) => (getTs(b.conversationTimestamp) || 0) - (getTs(a.conversationTimestamp) || 0))
            .slice(0, 60)
            .map(c => {
                const msgs = this._messages.get(c.id) || [];
                const last = msgs[msgs.length - 1];
                // Resolve best name: saved contact > pushName from last incoming msg > chat.name > phone number
                const name = this._resolveName(c.id, last?.pushName, c.name);
                return {
                    id: c.id,
                    name,
                    isGroup: c.id.endsWith('@g.us'),
                    unreadCount: c.unreadCount || 0,
                    lastMessage: last ? {
                        body: getMsgText(last),
                        timestamp: getTs(last.messageTimestamp),
                        fromMe: !!last.key?.fromMe,
                    } : null,
                    conversationTimestamp: getTs(c.conversationTimestamp),
                };
            });
    }

    _fmtMsg(msg) {
        return {
            id: msg.key.id,
            chatId: msg.key.remoteJid,
            body: getMsgText(msg),
            fromMe: !!msg.key.fromMe,
            timestamp: getTs(msg.messageTimestamp),
            pushName: msg.pushName || '',
        };
    }

    // ── Public API ────────────────────────────────────────────────────────────
    async getQRCode() {
        if (this.isReady) return { ready: true };
        if (this.qrRaw) return { qr: this.qrRaw };
        if (this.initError && !this.isInitializing) return { error: this.initError };
        if (!this.sock && !this.isInitializing) this.initialize();
        return { initializing: true };
    }

    async getStatus() {
        return {
            connected: this.isReady,
            isInitializing: this.isInitializing,
            qrGenerated: !!this.qrRaw,
            initError: this.initError || null,
            chatCount: this._chats.size,
        };
    }

    async getChats() {
        if (!this.isReady) throw new Error('WhatsApp not connected');
        return this._getFormattedChats();
    }

    async getChatMessages(chatId, limit = 50) {
        if (!this.isReady) throw new Error('WhatsApp not connected');
        const arr = this._messages.get(chatId) || [];
        return arr.slice(-limit).map(m => this._fmtMsg(m));
    }

    async markRead(chatId) {
        // Clear unread count in our local cache
        const chat = this._chats.get(chatId);
        if (chat) {
            this._chats.set(chatId, { ...chat, unreadCount: 0 });
            this._persistChats();
        }
        // Tell WA server that messages are read
        if (this.isReady && this.sock) {
            try {
                const msgs = this._messages.get(chatId) || [];
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg?.key) {
                    await this.sock.readMessages([lastMsg.key]);
                }
            } catch (e) { /* non-fatal */ }
        }
    }

    async sendMessage(chatId, text) {
        if (!this.isReady || !this.sock) throw new Error('WhatsApp not connected');
        await this.sock.sendMessage(chatId, { text });
        const fakeMsg = {
            key: { id: `out_${Date.now()}`, remoteJid: chatId, fromMe: true },
            message: { conversation: text },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: '',
        };
        if (!this._messages.has(chatId)) this._messages.set(chatId, []);
        this._messages.get(chatId).push(fakeMsg);
        return { success: true };
    }

    _clearAuth() {
        try {
            if (fs.existsSync(this.authDir))
                fs.rmSync(this.authDir, { recursive: true, force: true });
        } catch (e) {}
    }

    async disconnect() {
        try {
            if (this.sock) {
                try { await this.sock.logout(); } catch {}
                try { this.sock.end(undefined); } catch {}
                this.sock = null;
            }
            this.isReady = false;
            this.qrRaw = null;
            this.isInitializing = false;
            this.initError = null;
            this._chats.clear();
            this._messages.clear();
            this._contacts.clear();
            this._clearAuth();
            console.log('✅ WhatsApp disconnected + session cleared');
        } catch (err) {
            console.error('Disconnect error:', err.message);
        }
    }
}

const whatsappService = new WhatsAppService();
module.exports = whatsappService;
