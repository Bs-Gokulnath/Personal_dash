const Groq = require('groq-sdk');
require('dotenv').config();

// Initialize Groq client
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

/**
 * Generate an email draft based on user's natural language prompt
 * @param {string} userPrompt - The user's instruction
 * @param {object} emailContext - Context including original email
 * @param {string} tone - 'professional', 'casual', or 'formal'
 * @returns {object} Generated draft
 */
async function generateEmailDraft(userPrompt, emailContext = {}, tone = 'professional') {
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
            errorMessage = 'Groq API authentication failed. Please check your API key.';
        } else if (error.status === 429) {
            errorMessage = 'Groq API rate limit exceeded. Please wait a moment.';
        }
        
        return {
            success: false,
            error: errorMessage,
            draft: null
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
 * Test connection
 */
async function testConnection() {
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
    testConnection
};
