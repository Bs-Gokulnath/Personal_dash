const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
const readline = require('readline');

class TelegramService {
  constructor() {
    this.clients = new Map(); // userId -> client instance
    this.apiId = parseInt(process.env.TELEGRAM_API_ID);
    this.apiHash = process.env.TELEGRAM_API_HASH;
  }

  /**
   * Get or create Telegram client for a user
   */
  async getClient(userId, sessionString = '') {
    // Return existing client if available
    if (this.clients.has(userId)) {
      const existingClient = this.clients.get(userId);
      // Connect if not connected
      if (sessionString && !existingClient.connected) {
        await existingClient.connect();
        console.log(`✅ Reconnected existing client for user: ${userId}`);
      }
      return existingClient;
    }

    // Create new client with session
    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, this.apiId, this.apiHash, {
      connectionRetries: 5,
    });

    // If we have a session string, connect immediately
    if (sessionString) {
      await client.connect();
      console.log(`✅ Connected new client for user: ${userId}`);
    }

    // Store client
    this.clients.set(userId, client);
    
    return client;
  }

  /**
   * Start authentication process
   * Returns promise that resolves with session string
   */
  async authenticate(userId, phoneNumber, phoneCodeCallback, passwordCallback) {
    try {
      const client = await this.getClient(userId);

      await client.start({
        phoneNumber: async () => phoneNumber,
        phoneCode: phoneCodeCallback,
        password: passwordCallback,
        onError: (err) => {
          console.error('Telegram auth error:', err);
          throw err;
        },
      });

      // Get and return session string for storage
      const sessionString = client.session.save();
      
      console.log('✅ Telegram authentication successful for:', phoneNumber);
      
      return {
        success: true,
        sessionString,
        phoneNumber
      };

    } catch (error) {
      console.error('Telegram authentication failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all dialogs (chats) for authenticated user
   */
  async getDialogs(userId, limit = 50) {
    try {
      const client = this.clients.get(userId);
      if (!client) {
        throw new Error('Client not found. Please authenticate first.');
      }

      // Ensure client is connected
      if (!client.connected) {
        await client.connect();
        console.log(`✅ Connected client for getDialogs: ${userId}`);
      }

      console.log(`Fetching Telegram dialogs for user ${userId} with limit ${limit}`);
      const dialogs = await client.getDialogs({ limit });
      console.log(`Raw dialogs fetched: ${dialogs.length}`);
      
      return dialogs.map(dialog => {
        try {
            const chatEntity = dialog.entity;
            return {
                id: dialog.id ? dialog.id.toString() : (chatEntity?.id ? chatEntity.id.toString() : 'unknown'),
                title: dialog.title || chatEntity?.title || chatEntity?.firstName || 'Unknown',
                isGroup: !!dialog.isGroup,
                isChannel: !!dialog.isChannel,
                unreadCount: Number(dialog.unreadCount) || 0,
                date: Number(dialog.date) || 0,
                message: dialog.message ? {
                    id: dialog.message.id ? dialog.message.id.toString() : null,
                    text: dialog.message.message || '',
                    date: Number(dialog.message.date) || 0,
                    fromId: dialog.message.fromId ? 
                            (dialog.message.fromId.userId ? dialog.message.fromId.userId.toString() : 
                             dialog.message.fromId.channelId ? dialog.message.fromId.channelId.toString() : 
                             dialog.message.fromId.chatId ? dialog.message.fromId.chatId.toString() : null) 
                            : null
                } : null
            };
        } catch (err) {
            console.error('Error mapping dialog:', err);
            return null;
        }
      }).filter(Boolean);

    } catch (error) {
      console.error('Error fetching Telegram dialogs:', error);
      throw error;
    }
  }

  /**
   * Get messages from a specific chat
   */
  async getMessages(userId, chatId, limit = 50) {
    try {
      const client = this.clients.get(userId);
      if (!client) {
        throw new Error('Client not found');
      }

      const messages = await client.getMessages(chatId, { limit });
      
      return messages.map(msg => ({
        id: msg.id ? msg.id.toString() : Math.random().toString(36).substr(2, 9),
        text: msg.message || '',
        date: msg.date ? Number(msg.date) : Math.floor(Date.now() / 1000),
        fromId: msg.fromId ? 
                (msg.fromId.userId ? msg.fromId.userId.toString() : 
                 msg.fromId.channelId ? msg.fromId.channelId.toString() : 
                 msg.fromId.chatId ? msg.fromId.chatId.toString() : null) 
                : null,
        isOutgoing: !!msg.out,
        mediaType: msg.media ? msg.media.className : null,
      }));

    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  /**
   * Send a message
   */
  async sendMessage(userId, chatId, text) {
    try {
      const client = this.clients.get(userId);
      if (!client) {
        throw new Error('Client not found');
      }

      const result = await client.sendMessage(chatId, {
        message: text,
      });

      return {
        success: true,
        messageId: result.id,
        date: result.date
      };

    } catch (error) {
      console.error('Error sending message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Set up event handler for new messages
   */
  async setupMessageListener(userId, onNewMessage) {
    try {
      const client = this.clients.get(userId);
      if (!client) {
        throw new Error('Client not found');
      }

      client.addEventHandler((update) => {
        if (update.className === 'UpdateNewMessage') {
          const message = update.message;
          onNewMessage({
            chatId: message.peerId?.userId?.toString() || message.peerId?.channelId?.toString(),
            text: message.message,
            date: message.date,
            fromId: message.fromId?.userId?.toString(),
            isOutgoing: message.out
          });
        }
      });

      console.log('✅ Telegram message listener set up for user:', userId);

    } catch (error) {
      console.error('Error setting up listener:', error);
      throw error;
    }
  }

  /**
   * Disconnect client
   */
  async disconnect(userId) {
    const client = this.clients.get(userId);
    if (client) {
      await client.disconnect();
      this.clients.delete(userId);
      console.log('Telegram client disconnected for user:', userId);
    }
  }
}

// Export singleton instance
module.exports = new TelegramService();
