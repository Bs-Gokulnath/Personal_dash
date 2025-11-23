// Quick test script for Telegram authentication
require('dotenv').config();
const telegramService = require('./services/telegramService');
const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testTelegramAuth() {
  console.log('🔐 Telegram Authentication Test\n');

  try {
    // Step 1: Get phone number
    const phoneNumber = await question('Enter your phone number (with country code, e.g., +1234567890): ');
    
    console.log('\n📱 Connecting to Telegram...');
    
    // Step 2: Authenticate
    const result = await telegramService.authenticate(
      'test_user',
      phoneNumber.trim(),
      async () => {
        const code = await question('\n✉️  Enter the verification code from Telegram: ');
        return code.trim();
      },
      async () => {
        const password = await question('\n🔒 Enter 2FA password (or press Enter to skip): ');
        return password.trim() || undefined;
      }
    );

    if (!result.success) {
      console.error('\n❌ Authentication failed:', result.error);
      process.exit(1);
    }

    console.log('\n✅ Successfully authenticated!');
    console.log('📞 Phone:', result.phoneNumber);
    console.log('🔑 Session saved!');

    // Step 3: Test fetching chats
    console.log('\n📬 Fetching your recent chats...\n');
    
    const chats = await telegramService.getDialogs('test_user', 10);
    
    console.log(`Found ${chats.length} chats:\n`);
    chats.forEach((chat, index) => {
      console.log(`${index + 1}. ${chat.title}`);
      console.log(`   Unread: ${chat.unreadCount}`);
      if (chat.message) {
        console.log(`   Last message: ${chat.message.text.substring(0, 50)}...`);
      }
      console.log('');
    });

    console.log('✅ Everything is working perfectly!\n');
    
    // Save FULL session string to file
    fs.writeFileSync('telegram-session-string.txt', result.sessionString);
    console.log('📋 FULL session string saved to: telegram-session-string.txt');
    console.log(`📏 Length: ${result.sessionString.length} characters\n`);

    // Disconnect
    await telegramService.disconnect('test_user');
    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    rl.close();
    process.exit(1);
  }
}

testTelegramAuth();
