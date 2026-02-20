# Gmail OAuth Setup Instructions

To connect Gmail to your dashboard, you need to set up Google OAuth credentials.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project name

## Step 2: Enable Gmail API

1. In the Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Gmail API"
3. Click on it and press **Enable**

## Step 3: Create OAuth Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External** (for testing)
   - App name: Your app name (e.g., "Personal Dashboard")
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue**
   - Scopes: Skip for now, click **Save and Continue**
   - Test users: Add your Gmail address, click **Save and Continue**
   - Click **Back to Dashboard**

4. Now create the OAuth Client ID:
   - Application type: **Web application**
   - Name: "Personal Dashboard Web Client"
   - Authorized redirect URIs: Add `http://localhost:5000/oauth2callback`
   - Click **Create**

5. Download the credentials:
   - You'll see a dialog with your Client ID and Client Secret
   - Click **Download JSON**
   - This downloads a file like `client_secret_xxxxx.json`

## Step 4: Add Credentials to Your Project

1. Rename the downloaded file to `credentials.json`
2. Copy it to: `C:\React JS\Personal_dash\backend\server\credentials.json`

   OR you can use the template:
   - Copy `credentials.json.template` to `credentials.json`
   - Open `credentials.json` and replace:
     - `YOUR_CLIENT_ID` with your actual Client ID
     - `YOUR_CLIENT_SECRET` with your actual Client Secret
     - `your-project-id` with your project ID

3. Restart your backend server

## Step 5: Authorize the App

1. Go to http://localhost:5000/auth/google
2. You'll be redirected to Google's authorization page
3. Sign in with your Gmail account
4. Grant the requested permissions
5. You'll be redirected back to your app

## Troubleshooting

### Error: "Error generating auth URL. Did you add credentials.json?"
- Make sure `credentials.json` exists in the `backend/server` directory
- Verify the JSON format is correct
- Restart the backend server

### Error: "redirect_uri_mismatch"
- Make sure you added `http://localhost:5000/oauth2callback` to Authorized redirect URIs in Google Cloud Console
- The URI must match exactly (including http vs https)

### Error: "Access blocked: This app's request is invalid"
- Make sure you've enabled the Gmail API in your Google Cloud project
- Check that you've configured the OAuth consent screen

## Security Notes

- **Never commit `credentials.json` to version control** - it contains sensitive data
- The `.gitignore` should already exclude it
- For production, use environment variables and secure credential storage
