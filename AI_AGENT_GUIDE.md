# 🤖 AI Agent - Complete Guide

Your Crivo Inai dashboard now has an **AI Agent** that can perform real actions, not just chat!

## 🎯 What Can the AI Agent Do?

### ✅ Currently Implemented Actions:

1. **Send Emails** - Directly send emails on your behalf
2. **Create Email Drafts** - Prepare emails for review before sending
3. **Search Emails** - Find specific emails in your inbox

### 🚀 How to Use the AI Agent

Just chat naturally! The AI will understand your intent and perform actions automatically.

## 📝 Example Commands

### Sending Emails:

**You type:**
```
Send an email to john@example.com saying thank you for the meeting yesterday
```

**AI Agent:**
- ✅ Understands you want to send an email
- ✅ Extracts recipient: john@example.com
- ✅ Generates appropriate subject and body
- ✅ Sends the email immediately
- ✅ Confirms: "Email sent successfully to john@example.com!"

---

**You type:**
```
Email my professor at prof@university.edu asking for an extension on the assignment. Make it professional.
```

**AI Agent:**
- ✅ Creates professional email
- ✅ Sends to prof@university.edu
- ✅ Uses formal tone

---

### Creating Drafts:

**You type:**
```
Draft an email to team@company.com about tomorrow's meeting
```

**AI Agent:**
- ✅ Creates a draft (doesn't send)
- ✅ You can review it
- ✅ Confirms: "Draft created. You can review and send it."

---

### Searching Emails:

**You type:**
```
Find emails from Sarah about the project
```

**AI Agent:**
- ✅ Searches inbox
- ✅ Returns: "Found 3 emails matching 'from:Sarah project'"

---

**You type:**
```
Show me unread emails from this week
```

**AI Agent:**
- ✅ Searches with: "is:unread after:2026/02/13"
- ✅ Shows results

---

## 🎨 More Natural Examples

### Simple Commands:
- "Send a thank you email to alice@email.com"
- "Email Bob and ask about the deadline"
- "Message sarah@company.com about the report"

### Complex Requests:
- "Send an email to the team thanking them for their hard work this week. Make it warm and appreciative."
- "Draft a professional leave application to my manager for next Monday"
- "Email john@client.com with a project update. Mention we're on track and will deliver by Friday."

### Casual Requests:
- "Hey, shoot an email to Mike saying I'll be late"
- "Tell Sarah via email that the meeting is rescheduled"
- "Email the link presentation to team@work.com"

---

## 🔧 How It Works (Technical)

### 1. **Function Calling**
The AI uses GROQ's function calling feature to detect when you want to perform an action.

### 2. **Intent Recognition**
Keywords like "send", "email", "draft", "search" trigger action detection.

### 3. **Parameter Extraction**
The AI automatically extracts:
- Recipient email addresses
- Subject lines
- Email body content
- Tone/style preferences

### 4. **Action Execution**
The backend executes the actual action (sends email, creates draft, searches).

### 5. **Confirmation**
You get instant feedback: "✅ Email sent!" or "❌ Error: Gmail not connected"

---

## 🛠️ Extending the AI Agent

You can easily add more actions! Here's how:

### Adding a New Action (Example: Schedule Meeting)

**1. Define the function in `aiService.js`:**

```javascript
{
    name: "schedule_meeting",
    description: "Schedule a meeting with attendees",
    parameters: {
        type: "object",
        properties: {
            attendees: {
                type: "array",
                items: { type: "string" },
                description: "Email addresses of attendees"
            },
            date: {
                type: "string",
                description: "Meeting date (YYYY-MM-DD)"
            },
            time: {
                type: "string",
                description: "Meeting time (HH:MM)"
            },
            title: {
                type: "string",
                description: "Meeting title"
            }
        },
        required: ["attendees", "date", "time", "title"]
    }
}
```

**2. Implement the executor in `index.js`:**

```javascript
async function executeScheduleMeeting(args, userId) {
    try {
        // Call Google Calendar API or your calendar service
        const calendar = await getCalendarClient();
        const event = await calendar.events.insert({
            calendarId: 'primary',
            resource: {
                summary: args.title,
                start: { dateTime: `${args.date}T${args.time}:00` },
                attendees: args.attendees.map(email => ({ email }))
            }
        });
        
        return {
            success: true,
            message: `Meeting "${args.title}" scheduled for ${args.date} at ${args.time}`
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
```

**3. Add to switch statement:**

```javascript
case 'schedule_meeting':
    actionResult = await executeScheduleMeeting(args, userId);
    break;
```

**Done!** Now users can say: "Schedule a meeting with john@email.com tomorrow at 2pm about the project"

---

## 🎯 More Action Ideas

Here are more actions you can implement:

### 📅 Calendar
- `schedule_meeting` - Create calendar events
- `cancel_meeting` - Cancel meetings
- `list_today_meetings` - Show today's agenda

### 📧 Email Management
- `mark_as_read` - Mark emails as read
- `archive_email` - Archive specific emails
- `star_email` - Star important emails
- `apply_label` - Apply labels/categories

### 📝 Tasks
- `create_task` - Add to todo list
- `complete_task` - Mark task as done
- `list_tasks` - Show pending tasks

### 🔔 Notifications
- `set_reminder` - Create reminders
- `snooze_email` - Snooze email notifications

### 📊 Analytics
- `email_stats` - Show email statistics
- `top_senders` - Most frequent senders
- `unread_count` - Count unread emails

---

## 🔒 Security & Privacy

### What the AI Agent Can Do:
✅ Only perform actions you explicitly request
✅ Can only access your connected Gmail account
✅ All actions are logged for transparency

### What the AI Agent CANNOT Do:
❌ Access emails without your prompt
❌ Send emails without you asking
❌ Share your data with third parties
❌ Perform actions outside the defined functions

### Safety Features:
- All function calls are logged
- You can review actions in the console
- Failed actions won't crash the app
- Sensitive actions can require confirmation (implement confirmation prompts)

---

## 💡 Tips for Best Results

### Be Specific:
❌ "Email someone"
✅ "Email john@email.com about the meeting"

### Include All Details:
❌ "Send an email"
✅ "Send an email to sarah@company.com thanking her for the collaboration and asking about next steps"

### Use Natural Language:
You can be casual! The AI understands:
- "Shoot an email to..."
- "Tell [person] that..."
- "Message [email] about..."
- "Send [recipient] a note saying..."

### Mention Tone When Needed:
- "Send a formal email to..."
- "Draft a casual message to..."
- "Email my boss (make it professional) about..."

---

## 🐛 Troubleshooting

### "Gmail not connected"
**Solution:** Connect your Gmail account in the Connectors section first.

### "Failed to send email"
**Possible causes:**
- Invalid email address
- Gmail API rate limit
- Check backend logs for details

### AI doesn't recognize intent
**Try:**
- Be more explicit: "Send an email to..." instead of "Contact..."
- Include the email address explicitly
- Use action words: "send", "create", "search"

---

## 📊 Current Capabilities Summary

| Action | Status | Example Command |
|--------|--------|-----------------|
| Send Email | ✅ Working | "Send email to john@mail.com" |
| Create Draft | ✅ Working | "Draft an email to sarah@email.com" |
| Search Emails | ✅ Working | "Find emails from Mike" |
| Reply to Email | 🚧 Coming Soon | "Reply to the last email from Alice" |
| Schedule Meeting | 🚧 Coming Soon | "Schedule meeting with team tomorrow" |
| Set Reminder | 🚧 Coming Soon | "Remind me to follow up with Bob" |

---

## 🎓 Advanced Usage

### Chain Multiple Actions:
"Send an email to john@email.com about the meeting, then search for emails from Sarah about the project"
(Currently processes one action per message, but you can send multiple messages)

### Context Awareness:
The AI remembers the last 5 messages in your conversation, so you can say:
- You: "Draft an email to alice@email.com"
- AI: "Draft created..."
- You: "Actually, send it now"
- AI: *Sends the email*

### Custom Instructions:
"Send an email to team@company.com. Subject: Weekly Update. Include 3 bullet points about progress."

---

## 🚀 What's Next?

### Planned Features:
1. **Confirmation Prompts** - For sensitive actions like sending emails
2. **Undo Actions** - Recall recently sent emails
3. **Scheduled Sending** - "Send this email tomorrow at 9am"
4. **Email Templates** - "Use my follow-up template"
5. **Batch Actions** - "Archive all emails from last week"
6. **Voice Commands** - Speak to the AI agent
7. **Multi-platform** - Extend to WhatsApp, Telegram

---

## 🎉 Try It Now!

Open your AI Assistant and try:
```
Send an email to yourself (use your email) saying "Testing the AI Agent feature!"
```

The AI will send you an email! Check your inbox. 🚀

---

## 📞 Support

- Check console logs for debugging
- Review the code in:
  - `/backend/server/services/aiService.js` (AI logic)
  - `/backend/server/index.js` (Action executors)
  - `/per_dash/src/pages/Dashboard.jsx` (Frontend)

**Happy automating! 🤖✨**
