# Get Your Free GROQ API Key

GROQ provides super-fast AI models for free! Follow these steps to get your API key:

## Quick Steps:

1. **Go to GROQ Console**: https://console.groq.com/keys

2. **Sign Up / Log In**:
   - Click "Sign In" or "Get Started"
   - You can use Google, GitHub, or email

3. **Create API Key**:
   - Once logged in, you'll see the API Keys page
   - Click **"Create API Key"**
   - Give it a name (e.g., "Personal Dashboard")
   - Copy the API key (it starts with `gsk_...`)

4. **Add to Your .env File**:
   - Open: `backend/server/.env`
   - Replace this line:
     ```
     GROQ_API_KEY=your_groq_api_key_here
     ```
   - With your actual key:
     ```
     GROQ_API_KEY=gsk_your_actual_key_here
     ```

5. **Restart Backend**:
   - The server will automatically pick up the new key
   - You should see: `✅ Groq AI initialized successfully`

## Benefits of GROQ:

- ⚡ **Super Fast**: Fastest LLM inference available
- 🆓 **100% Free**: Generous free tier
- 🎯 **High Quality**: Uses Llama 3.1 and other top models
- 🔒 **Secure**: Your data is not used for training

## What Happens Without the Key:

Your app will still work! It uses a template-based fallback system that generates email drafts based on common patterns. However, with GROQ AI, you get:
- More contextual and personalized emails
- Better understanding of complex requests
- Smarter tone adaptation
- More natural language generation

## Current Status:

✅ Template-based generation is working (fallback mode)
🔄 To enable AI generation: Add GROQ_API_KEY to .env file
