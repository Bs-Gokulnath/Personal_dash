const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

class WhatsAppBusinessService {
    constructor() {
        this.apiToken = process.env.WHATSAPP_API_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
        this.appSecret = process.env.WHATSAPP_APP_SECRET;
    }

    /**
     * Send a text message
     * @param {string} to - Recipient phone number (format: 919876543210)
     * @param {string} message - Message text
     * @param {string} accessToken - Optional custom access token
     * @returns {Promise<object>} Message send result
     */
    async sendMessage(to, message, accessToken = null) {
        try {
            const token = accessToken || this.apiToken;
            const phoneId = this.phoneNumberId;

            if (!token || !phoneId) {
                throw new Error('WhatsApp API credentials not configured');
            }

            const url = `${WHATSAPP_API_URL}/${phoneId}/messages`;
            
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'text',
                text: {
                    preview_url: false,
                    body: message
                }
            };

            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ WhatsApp message sent:', response.data);

            return {
                success: true,
                messageId: response.data.messages[0].id,
                data: response.data
            };

        } catch (error) {
            console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
            
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message,
                details: error.response?.data
            };
        }
    }

    /**
     * Send a template message (for business-initiated conversations)
     * @param {string} to - Recipient phone number
     * @param {string} templateName - Approved template name
     * @param {string} languageCode - Template language (e.g., 'en', 'en_US')
     * @param {array} components - Template components/parameters
     * @param {string} accessToken - Optional custom access token
     * @returns {Promise<object>} Message send result
     */
    async sendTemplateMessage(to, templateName, languageCode = 'en', components = [], accessToken = null) {
        try {
            const token = accessToken || this.apiToken;
            const phoneId = this.phoneNumberId;

            if (!token || !phoneId) {
                throw new Error('WhatsApp API credentials not configured');
            }

            const url = `${WHATSAPP_API_URL}/${phoneId}/messages`;
            
            const payload = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: languageCode
                    },
                    components: components
                }
            };

            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ WhatsApp template message sent:', response.data);

            return {
                success: true,
                messageId: response.data.messages[0].id,
                data: response.data
            };

        } catch (error) {
            console.error('❌ Error sending WhatsApp template:', error.response?.data || error.message);
            
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message,
                details: error.response?.data
            };
        }
    }

    /**
     * Verify webhook signature for security
     * @param {string} payload - Request body as string
     * @param {string} signature - X-Hub-Signature-256 header value
     * @returns {boolean} Whether signature is valid
     */
    verifyWebhookSignature(payload, signature) {
        try {
            if (!this.appSecret) {
                console.warn('⚠️ App secret not configured, skipping signature verification');
                return true; // Allow in development
            }

            const expectedSignature = crypto
                .createHmac('sha256', this.appSecret)
                .update(payload)
                .digest('hex');

            const signatureHash = signature.split('sha256=')[1];
            
            return crypto.timingSafeEqual(
                Buffer.from(expectedSignature),
                Buffer.from(signatureHash)
            );
        } catch (error) {
            console.error('Error verifying webhook signature:', error);
            return false;
        }
    }

    /**
     * Parse incoming webhook message
     * @param {object} webhookData - Webhook payload
     * @returns {object|null} Parsed message data
     */
    parseWebhookMessage(webhookData) {
        try {
            const entry = webhookData.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;

            if (!value) {
                return null;
            }

            // Handle message events
            if (value.messages && value.messages.length > 0) {
                const message = value.messages[0];
                const contact = value.contacts?.[0];

                return {
                    type: 'message',
                    messageId: message.id,
                    from: message.from,
                    timestamp: message.timestamp,
                    text: message.text?.body || '',
                    messageType: message.type,
                    contactName: contact?.profile?.name || 'Unknown',
                    metadata: value.metadata
                };
            }

            // Handle status updates (delivered, read, etc.)
            if (value.statuses && value.statuses.length > 0) {
                const status = value.statuses[0];

                return {
                    type: 'status',
                    messageId: status.id,
                    status: status.status, // sent, delivered, read, failed
                    timestamp: status.timestamp,
                    recipientId: status.recipient_id
                };
            }

            return null;

        } catch (error) {
            console.error('Error parsing webhook message:', error);
            return null;
        }
    }

    /**
     * Get message templates
     * @param {string} accessToken - Access token
     * @param {string} businessAccountId - WhatsApp Business Account ID
     * @returns {Promise<object>} Templates list
     */
    async getMessageTemplates(accessToken, businessAccountId) {
        try {
            const url = `${WHATSAPP_API_URL}/${businessAccountId}/message_templates`;
            
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                params: {
                    limit: 100
                }
            });

            return {
                success: true,
                templates: response.data.data || []
            };

        } catch (error) {
            console.error('Error fetching templates:', error.response?.data || error.message);
            
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message,
                templates: []
            };
        }
    }

    /**
     * Test API connection
     * @param {string} accessToken - Access token to test
     * @param {string} phoneNumberId - Phone number ID to test
     * @returns {Promise<object>} Connection test result
     */
    async testConnection(accessToken, phoneNumberId) {
        try {
            const url = `${WHATSAPP_API_URL}/${phoneNumberId}`;
            
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return {
                success: true,
                message: 'WhatsApp API connection successful',
                phoneNumber: response.data.display_phone_number,
                verifiedName: response.data.verified_name,
                qualityRating: response.data.quality_rating
            };

        } catch (error) {
            console.error('WhatsApp connection test failed:', error.response?.data || error.message);
            
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Mark message as read
     * @param {string} messageId - Message ID to mark as read
     * @param {string} accessToken - Access token
     * @returns {Promise<object>} Result
     */
    async markMessageAsRead(messageId, accessToken = null) {
        try {
            const token = accessToken || this.apiToken;
            const phoneId = this.phoneNumberId;

            const url = `${WHATSAPP_API_URL}/${phoneId}/messages`;
            
            const payload = {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId
            };

            await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            return { success: true };

        } catch (error) {
            console.error('Error marking message as read:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Upload media file
     * @param {Buffer} fileBuffer - File buffer
     * @param {string} mimeType - MIME type
     * @param {string} accessToken - Access token
     * @returns {Promise<object>} Upload result with media ID
     */
    async uploadMedia(fileBuffer, mimeType, accessToken = null) {
        try {
            const token = accessToken || this.apiToken;
            const phoneId = this.phoneNumberId;

            const url = `${WHATSAPP_API_URL}/${phoneId}/media`;
            
            const FormData = require('form-data');
            const form = new FormData();
            form.append('messaging_product', 'whatsapp');
            form.append('file', fileBuffer, {
                contentType: mimeType,
                filename: 'file'
            });

            const response = await axios.post(url, form, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    ...form.getHeaders()
                }
            });

            return {
                success: true,
                mediaId: response.data.id
            };

        } catch (error) {
            console.error('Error uploading media:', error.response?.data || error.message);
            
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }
}

module.exports = new WhatsAppBusinessService();
