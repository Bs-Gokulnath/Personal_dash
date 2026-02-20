const Groq = require('groq-sdk');
require('dotenv').config();

// Initialize Groq client only if API key is valid
let groq = null;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (GROQ_API_KEY && GROQ_API_KEY !== 'your_groq_api_key_here' && GROQ_API_KEY.length > 20) {
    try {
        groq = new Groq({ apiKey: GROQ_API_KEY });
        console.log('✅ Groq AI initialized successfully');
    } catch (error) {
        console.error('⚠️ Failed to initialize Groq AI:', error.message);
    }
} else {
    console.log('⚠️ GROQ_API_KEY not configured. Using template-based email generation.');
    console.log('   Get a free API key at: https://console.groq.com/keys');
}

/**
 * Generate an email draft using templates (fallback when API key is missing)
 */
function generateTemplateBasedDraft(userPrompt, emailContext = {}, tone = 'professional') {
    const original = emailContext.originalEmail || {};
    const isReply = original.subject || original.from;
    
    let subject = '';
    let body = '';
    let to = original.from || '';
    
    // Determine subject
    if (isReply && original.subject) {
        subject = original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`;
    } else {
        subject = 'Your subject here';
    }
    
    // Generate body based on tone
    const greeting = tone === 'casual' ? 'Hi' : tone === 'formal' ? 'Dear Sir/Madam' : 'Hello';
    const closing = tone === 'casual' ? 'Cheers' : tone === 'formal' ? 'Sincerely' : 'Best regards';
    
    // Extract key information from user prompt
    const promptLower = userPrompt.toLowerCase();
    
    if (promptLower.includes('accept') || promptLower.includes('yes') || promptLower.includes('agree')) {
        body = `<p>${greeting},</p>
<p>Thank you for reaching out. I'm writing to confirm that I accept your proposal/request.</p>
<p>[Add your specific details based on: "${userPrompt}"]</p>
<p>Please let me know if you need any additional information.</p>
<p>${closing},<br>Your Name</p>`;
    } else if (promptLower.includes('decline') || promptLower.includes('no') || promptLower.includes('reject')) {
        body = `<p>${greeting},</p>
<p>Thank you for your message. After careful consideration, I must respectfully decline.</p>
<p>[Add your specific reason based on: "${userPrompt}"]</p>
<p>I appreciate your understanding.</p>
<p>${closing},<br>Your Name</p>`;
    } else if (promptLower.includes('thank')) {
        body = `<p>${greeting},</p>
<p>Thank you so much for your message. I really appreciate it.</p>
<p>[Add your specific response based on: "${userPrompt}"]</p>
<p>${closing},<br>Your Name</p>`;
    } else if (isReply && original.body) {
        body = `<p>${greeting},</p>
<p>Thank you for your email.</p>
<p>[Your response to: "${userPrompt}"]</p>
<p>Regarding your message: "${original.snippet || original.body?.substring(0, 100) || ''}"</p>
<p>${closing},<br>Your Name</p>`;
    } else {
        body = `<p>${greeting},</p>
<p>I'm writing regarding: ${userPrompt}</p>
<p>[Your email content here]</p>
<p>Looking forward to hearing from you.</p>
<p>${closing},<br>Your Name</p>`;
    }
    
    return {
        to,
        subject,
        body,
        _template: true,
        _note: 'This is a template. Configure GROQ_API_KEY for AI-generated emails.'
    };
}

/**
 * Generate an email draft based on user's natural language prompt
 * @param {string} userPrompt - The user's instruction
 * @param {object} emailContext - Context including original email  
 * @param {string} tone - 'professional', 'casual', or 'formal'
 * @returns {object} Generated draft
 */
async function generateEmailDraft(userPrompt, emailContext = {}, tone = 'professional') {
    // If Groq is not initialized, use template-based generation
    if (!groq) {
        console.log('📝 Using template-based email generation (GROQ_API_KEY not configured)');
        const draft = generateTemplateBasedDraft(userPrompt, emailContext, tone);
        
        return {
            success: true,
            draft,
            metadata: {
                provider: 'template',
                model: 'template-v1',
                timestamp: new Date().toISOString()
            }
        };
    }
    
    try {
        // Build context from the original email if available
        let contextText = '';
        if (emailContext.originalEmail) {
            const original = emailContext.originalEmail;
            contextText = `
Original Email Context:
From: ${original.from || 'Unknown'}
Subject: ${original.subject || 'No subject'}
Body: ${original.body || original.snippet || ''}
`;
        }

        // Construct the prompt
        const prompt = `You are an AI email writing assistant. Generate a professional email based on the user's request.

User Request: "${userPrompt}"

${contextText}

Tone: ${tone}
User's Email: ${emailContext.userEmail || 'user@example.com'}

Instructions:
1. If this is a reply, use "Re: [original subject]" format
2. Generate appropriate to, subject, and body fields
3. Write in ${tone} tone
4. Keep the email concise and clear
5. Use proper email formatting with HTML tags for structure
6. Include appropriate greeting and signature

Return ONLY a JSON object with this exact structure (no markdown, no other text):
{
  "to": "recipient@example.com",
  "subject": "Email subject here",
  "body": "<p>Email body with HTML formatting</p>"
}`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "llama-3.1-8b-instant", // Fast and free
            temperature: 0.7,
            max_tokens: 1024,
        });

        const responseText = completion.choices[0]?.message?.content || '';
        
        // Parse the JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('AI did not return valid JSON format. Response: ' + responseText);
        }

        const draft = JSON.parse(jsonMatch[0]);

        // Validate required fields
        if (!draft.to || !draft.subject || !draft.body) {
            throw new Error('Generated draft missing required fields');
        }

        return {
            success: true,
            draft,
            metadata: {
                provider: 'groq',
                model: 'llama-3.1-8b-instant',
                tone: tone
            }
        };

    } catch (error) {
        console.error('Error generating email draft:', error);
        
        let errorMessage = error.message;
        if (error.status === 401) {
            errorMessage = 'Groq API authentication failed. Using template fallback.';
            console.log('💡 Get a free GROQ API key at: https://console.groq.com/keys');
        } else if (error.status === 429) {
            errorMessage = 'Groq API rate limit exceeded. Using template fallback.';
        }
        
        // Fallback to template-based generation on error
        console.log('⚠️ AI generation failed, using template fallback');
        const draft = generateTemplateBasedDraft(userPrompt, emailContext, tone);
        
        return {
            success: true,
            draft,
            metadata: {
                provider: 'template-fallback',
                model: 'template-v1',
                timestamp: new Date().toISOString(),
                warning: errorMessage
            }
        };
    }
}

/**
 * Summarize email content
 */
async function summarizeEmail(emailContent) {
    try {
        const prompt = `Summarize the following email concisely. Provide:
1. A brief 1-2 sentence summary
2. 3-5 key points as a bullet list

Email to summarize:
${emailContent}

Return ONLY a JSON object (no markdown):
{
  "summary": "Brief 1-2 sentence summary",
  "keyPoints": ["Point 1", "Point 2", "Point 3"]
}`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.1-8b-instant",
            temperature: 0.5,
            max_tokens: 512,
        });

        const responseText = completion.choices[0]?.message?.content || '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error('AI did not return valid JSON format');
        }

        const summaryData = JSON.parse(jsonMatch[0]);

        return {
            success: true,
            summary: summaryData.summary,
            keyPoints: summaryData.keyPoints || [],
            metadata: {
                provider: 'groq',
                model: 'llama-3.1-8b-instant'
            }
        };

    } catch (error) {
        console.error('Error summarizing email:', error);
        return {
            success: false,
            error: error.message,
            summary: null,
            keyPoints: []
        };
    }
}

/**
 * Improve email draft
 */
async function improveDraft(currentDraft, instruction) {
    try {
        const prompt = `You are an AI email writing assistant. Improve the following email draft based on the user's instruction.

Current Draft:
${currentDraft}

User's Improvement Request: "${instruction}"

Instructions:
1. Apply the user's requested changes
2. Maintain professional email formatting
3. Keep the core message intact unless specifically asked to change it
4. Use HTML tags for formatting

Return ONLY the improved email body text (HTML formatted), nothing else.`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            max_tokens: 1024,
        });

        const improvedBody = completion.choices[0]?.message?.content || '';

        return {
            success: true,
            improvedBody: improvedBody.trim(),
            metadata: {
                provider: 'groq',
                model: 'llama-3.1-8b-instant'
            }
        };

    } catch (error) {
        console.error('Error improving draft:', error);
        return {
            success: false,
            error: error.message,
            improvedBody: null
        };
    }
}

/**
 * General Chat with AI
 */
/**
 * Available functions/tools that the AI agent can call
 */
const availableFunctions = [
    {
        name: "send_email",
        description: "Send an email to a recipient. Use this when user explicitly asks to send an email.",
        parameters: {
            type: "object",
            properties: {
                to: {
                    type: "string",
                    description: "The recipient's email address"
                },
                subject: {
                    type: "string",
                    description: "The email subject line"
                },
                body: {
                    type: "string",
                    description: "The email body content"
                }
            },
            required: ["to", "subject", "body"]
        }
    },
    {
        name: "create_draft",
        description: "Create an email draft without sending it. Use when user wants to prepare an email for review.",
        parameters: {
            type: "object",
            properties: {
                to: {
                    type: "string",
                    description: "The recipient's email address"
                },
                subject: {
                    type: "string",
                    description: "The email subject line"
                },
                body: {
                    type: "string",
                    description: "The email body content"
                },
                tone: {
                    type: "string",
                    enum: ["professional", "casual", "formal"],
                    description: "The tone of the email"
                }
            },
            required: ["to", "subject", "body"]
        }
    },
    {
        name: "search_emails",
        description: "Search through user's emails. Use when user wants to find specific emails.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search query (sender name, subject keywords, etc.)"
                }
            },
            required: ["query"]
        }
    }
];

/**
 * Generate a simple chat response using templates (fallback)
 */
function generateTemplateChatResponse(prompt) {
    const promptLower = prompt.toLowerCase();
    
    // Simple keyword-based responses
    if (promptLower.includes('hello') || promptLower.includes('hi') || promptLower.includes('hey')) {
        return "Hello! I'm your Crivo Inai assistant. How can I help you today?";
    }
    
    if (promptLower.includes('help')) {
        return "I can help you with:\n• Composing and replying to emails\n• Generating email drafts\n• Managing your communications\n• General questions about the app\n\nWhat would you like to do?";
    }
    
    if (promptLower.includes('email') || promptLower.includes('mail')) {
        return "I can help you with emails! You can:\n• Click 'Generate' on any email to create a reply\n• Use the compose button to write new emails\n• Ask me to help draft specific messages\n\nWhat email task would you like help with?";
    }
    
    if (promptLower.includes('send') && promptLower.includes('mail')) {
        return "To send an email:\n1. Click the compose button\n2. Enter recipient, subject, and message\n3. Or use AI to generate the content\n4. Click send!\n\nWould you like me to help draft an email?";
    }
    
    if (promptLower.includes('thank')) {
        return "You're welcome! I'm here to help. Let me know if you need anything else! 😊";
    }
    
    // Generic helpful response
    return "I understand you're asking about: \"" + prompt + "\"\n\nI'm currently running in template mode. For more intelligent responses, please configure the GROQ_API_KEY in your .env file.\n\nGet a free API key at: https://console.groq.com/keys\n\nHow else can I assist you?";
}

/**
 * Chat with AI assistant with function calling support
 * @param {string} prompt - User's message
 * @param {object} context - Additional context (user email, conversation history, etc.)
 * @returns {object} AI response with optional function calls
 */
async function chatWithAI(prompt, context = {}) {
    // If Groq is not initialized, use template-based responses
    if (!groq) {
        console.log('💬 Using template-based chat (GROQ_API_KEY not configured)');
        const response = generateTemplateChatResponse(prompt);
        
        return {
            success: true,
            response,
            metadata: {
                provider: 'template',
                model: 'template-chat-v1'
            }
        };
    }
    
    try {
        const messages = [
            { 
                role: "system", 
                content: `You are an AI agent assistant for Crivo Inai email management application. You can perform actions for the user.

When the user asks you to perform an action (like sending an email, creating a draft, or searching emails), you should:
1. Use the available functions to perform the action
2. Provide a clear confirmation of what you did

Available capabilities:
- Send emails directly when asked
- Create email drafts for review
- Search through emails
- Answer questions about the app

Be proactive, helpful, and confirm actions clearly. The user's email is: ${context.userEmail || 'not provided'}`
            },
            { role: "user", content: prompt }
        ];

        // First call: Check if AI wants to use any tools
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile", // Using latest 70B model for better function calling
            messages: messages,
            tools: availableFunctions.map(func => ({
                type: "function",
                function: {
                    name: func.name,
                    description: func.description,
                    parameters: func.parameters
                }
            })),
            tool_choice: "auto",
            temperature: 0.7,
            max_tokens: 1024,
        });

        const responseMessage = response.choices[0]?.message;

        // Check if AI wants to call a function
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            const toolCall = responseMessage.tool_calls[0];
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);

            console.log(`🤖 AI Agent wants to call function: ${functionName}`, functionArgs);

            return {
                success: true,
                response: responseMessage.content || `I'll help you with that.`,
                functionCall: {
                    name: functionName,
                    arguments: functionArgs,
                    id: toolCall.id
                },
                metadata: {
                    provider: 'groq',
                    model: 'llama-3.3-70b-versatile',
                    hasAction: true
                }
            };
        }

        // No function call, just return the response
        return {
            success: true,
            response: responseMessage.content || '',
            metadata: {
                provider: 'groq',
                model: 'llama-3.3-70b-versatile'
            }
        };

    } catch (error) {
        console.error('Error in AI chat:', error);
        console.log('⚠️ AI chat failed, using template fallback');
        
        // Fallback to template-based response
        const response = generateTemplateChatResponse(prompt);
        
        return {
            success: true,
            response,
            metadata: {
                provider: 'template-fallback',
                model: 'template-chat-v1',
                warning: error.message
            }
        };
    }
}

/**
 * Test connection
 */
async function testConnection() {
    if (!groq) {
        return {
            success: true,
            message: 'AI service running in template mode (GROQ_API_KEY not configured)',
            mode: 'template'
        };
    }
    
    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: 'Say "AI service connected successfully"' }],
            model: "llama-3.1-8b-instant",
            max_tokens: 50,
        });
        
        return {
            success: true,
            message: completion.choices[0]?.message?.content || 'Connected!'
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    generateEmailDraft,
    summarizeEmail,
    improveDraft,
    chatWithAI,
    testConnection
};
