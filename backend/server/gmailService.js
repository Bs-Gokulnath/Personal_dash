const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send'
];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Global OAuth2 client instance
let oauth2Client = null;

/**
 * Helper to save tokens, merging with existing ones to preserve refresh_token.
 */
async function saveTokens(newTokens) {
  try {
    let currentTokens = {};
    try {
      const content = await fs.readFile(TOKEN_PATH);
      currentTokens = JSON.parse(content);
    } catch (e) {
      // File might not exist yet
    }
    
    const mergedTokens = { ...currentTokens, ...newTokens };
    await fs.writeFile(TOKEN_PATH, JSON.stringify(mergedTokens));
    console.log('Tokens updated and saved to disk');
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
}

/**
 * Reads the credentials.json file and creates an OAuth2 client.
 */
async function getAuthClient() {
  if (oauth2Client) return oauth2Client;
  
  try {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const credentials = JSON.parse(content);
    const { client_secret, client_id, redirect_uris } = credentials.web || credentials.installed;
    
    oauth2Client = new google.auth.OAuth2(
      client_id, 
      client_secret, 
      redirect_uris[0]
    );

    // CRITICAL: Listen for token updates (refresh) and save them
    oauth2Client.on('tokens', (tokens) => {
      console.log('OAuth2 Client received new tokens (refresh)');
      saveTokens(tokens);
    });

    // Load existing token if available
    try {
      const token = await fs.readFile(TOKEN_PATH);
      oauth2Client.setCredentials(JSON.parse(token));
    } catch (err) {
      // No token yet, that's okay
    }

    return oauth2Client;
  } catch (error) {
    console.error("Error loading credentials.json:", error);
    return null;
  }
}

/**
 * Generates the URL for the user to authorize the app.
 */
async function getAuthUrl(forceConsent = false) {
  const authClient = await getAuthClient();
  if (!authClient) throw new Error('Could not create auth client');

  const authUrlOptions = {
    access_type: 'offline',
    scope: SCOPES,
  };

  // Force consent screen to show even if previously authorized
  if (forceConsent) {
    authUrlOptions.prompt = 'consent';
  }

  return authClient.generateAuthUrl(authUrlOptions);
}

/**
 * Exchanges the auth code for a token and saves it.
 */
async function getAndSaveToken(code) {
  const authClient = await getAuthClient();
  if (!authClient) throw new Error('Could not create auth client');

  const { tokens } = await authClient.getToken(code);
  authClient.setCredentials(tokens);
  
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
  console.log('Token stored to', TOKEN_PATH);
  
  return tokens;
}

/**
 * Gets a fully authorized Gmail client.
 */
async function getGmailClient() {
  const authClient = await getAuthClient();
  if (!authClient) return null;

  // Check if we already have valid credentials in memory
  if (authClient.credentials && Object.keys(authClient.credentials).length > 0) {
    return google.gmail({ version: 'v1', auth: authClient });
  }

  // Fallback: Try to load from disk if not in memory (e.g. if getAuthClient didn't load it for some reason)
  try {
    const token = await fs.readFile(TOKEN_PATH);
    authClient.setCredentials(JSON.parse(token));
    return google.gmail({ version: 'v1', auth: authClient });
  } catch (error) {
    return null; // No token found, user needs to auth
  }
}

module.exports = {
  getAuthUrl,
  getAndSaveToken,
  getGmailClient,
  get oauth2Client() {
    return oauth2Client;
  }
};
