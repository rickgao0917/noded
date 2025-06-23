# Gemini API Setup Guide

## Quick Fix for API Errors

If you're seeing errors like:
- "Failed to communicate with Gemini API"
- "Unable to get AI response"
- "Gemini API key not configured"

Follow these steps:

## 1. Get Your Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

## 2. Configure Your API Key

1. Open the file: `config/config.js`
2. Find this line:
   ```javascript
   GEMINI_API_KEY: 'YOUR_API_KEY_HERE',
   ```
3. Replace `YOUR_API_KEY_HERE` with your actual API key:
   ```javascript
   GEMINI_API_KEY: 'AIzaSy...[your-actual-key-here]',
   ```
4. Save the file

## 3. Rebuild and Restart

After adding your API key:

```bash
# Rebuild the project
npm run build

# Restart the server
npm run server
```

## 4. Test Your Setup

1. Open http://localhost:8000
2. Login with your credentials
3. Try submitting a prompt to Gemini

## Troubleshooting

### Still getting "API key not configured" error?
- Make sure you saved the `config/config.js` file
- Check that you replaced the entire 'YOUR_API_KEY_HERE' string
- Try clearing your browser cache and refreshing

### Getting "Invalid API key" error?
- Verify your API key is correct at https://aistudio.google.com/apikey
- Make sure you copied the entire key
- Check that there are no extra spaces or quotes

### Branch Creation Issues
If you're seeing unexpected branches being created:
- This was a bug that created empty response blocks even when API calls failed
- It has been fixed - response blocks are now only created after successful API connection
- Clear your browser cache and refresh to get the latest version

## Security Note

**Never commit your API key to version control!**

The `config/config.js` file is already in `.gitignore` to prevent accidental commits.