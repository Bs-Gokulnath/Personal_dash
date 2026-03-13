const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');

// If modifying these scopes, delete all token_*.json files.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
];

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Per-user OAuth2 clients: Map<userId, oauth2Client>
const userClients = new Map();

function getTokenPath(userId) {
  return path.join(__dirname, `token_${userId}.json`);
}

async function saveTokens(userId, newTokens) {
  try {
    const tokenPath = getTokenPath(userId);
    let current = {};
    try { current = JSON.parse(await fs.readFile(tokenPath)); } catch {}
    await fs.writeFile(tokenPath, JSON.stringify({ ...current, ...newTokens }));
  } catch (error) {
    console.error('Error saving tokens for user', userId, error);
  }
}

async function getCredentials() {
  try {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const credentials = JSON.parse(content);
    const creds = credentials.web || credentials.installed;
    console.log('✅ Loaded Gmail credentials from credentials.json');
    return { client_id: creds.client_id, client_secret: creds.client_secret, redirect_uri: creds.redirect_uris[0] };
  } catch {
    const client_id = process.env.GMAIL_CLIENT_ID;
    const client_secret = process.env.GMAIL_CLIENT_SECRET;
    const redirect_uri = process.env.GMAIL_REDIRECT_URI;
    if (!client_id || !client_secret || !redirect_uri) {
      console.error('❌ Gmail credentials missing!');
      return null;
    }
    console.log('✅ Loaded Gmail credentials from environment variables');
    return { client_id, client_secret, redirect_uri };
  }
}

async function getAuthClient(userId) {
  if (userClients.has(userId)) return userClients.get(userId);

  const creds = await getCredentials();
  if (!creds) return null;

  const client = new google.auth.OAuth2(creds.client_id, creds.client_secret, creds.redirect_uri);

  client.on('tokens', (tokens) => {
    saveTokens(userId, tokens);
  });

  // Load existing token if available
  try {
    const token = JSON.parse(await fs.readFile(getTokenPath(userId)));
    client.setCredentials(token);
  } catch {}

  userClients.set(userId, client);
  return client;
}

async function getAuthUrl(userId) {
  const creds = await getCredentials();
  if (!creds) throw new Error('Could not load Gmail credentials');

  const client = new google.auth.OAuth2(creds.client_id, creds.client_secret, creds.redirect_uri);
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: userId  // pass userId through OAuth so we know who authenticated
  });
}

async function getAndSaveToken(code, userId) {
  const client = await getAuthClient(userId);
  if (!client) throw new Error('Could not create auth client');

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  await fs.writeFile(getTokenPath(userId), JSON.stringify(tokens));
  console.log(`Token stored for user: ${userId}`);
  return tokens;
}

async function getGmailClient(userId) {
  if (!userId) return null;
  const client = await getAuthClient(userId);
  if (!client) return null;

  if (client.credentials && Object.keys(client.credentials).length > 0) {
    return google.gmail({ version: 'v1', auth: client });
  }

  // Try user-specific token first, then fall back to legacy token.json
  const tokenPaths = [getTokenPath(userId), path.join(__dirname, 'token.json')];
  for (const tokenPath of tokenPaths) {
    try {
      const token = JSON.parse(await fs.readFile(tokenPath));
      client.setCredentials(token);
      // Migrate legacy token to user-specific file
      if (tokenPath.endsWith('token.json')) {
        await fs.writeFile(getTokenPath(userId), JSON.stringify(token)).catch(() => {});
        console.log(`Migrated legacy token.json to token_${userId}.json`);
      }
      return google.gmail({ version: 'v1', auth: client });
    } catch {}
  }
  return null;
}

async function isGmailConnected(userId) {
  if (!userId) return false;
  for (const p of [getTokenPath(userId), path.join(__dirname, 'token.json')]) {
    try { await fs.access(p); return true; } catch {}
  }
  return false;
}

async function disconnectGmail(userId) {
  if (!userId) return;
  try { await fs.unlink(getTokenPath(userId)); } catch {}
  userClients.delete(userId);
}

module.exports = {
  getAuthUrl,
  getAndSaveToken,
  getGmailClient,
  isGmailConnected,
  disconnectGmail,
  // legacy compat
  get oauth2Client() { return userClients.values().next().value || null; }
};
