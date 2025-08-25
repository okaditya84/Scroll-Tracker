# 🚀 Deployment Guide for Scroll Tracker

## 📋 Prerequisites
- GitHub account
- Chrome Developer Console account ($5 one-time fee)
- MongoDB Atlas account (free tier)
- Groq API key (free tier)
- Render.com account (free tier)

## 🎯 Step 1: Prepare GitHub Repository

1. **Create a new GitHub repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Scroll Tracker Extension"
   git remote add origin https://github.com/YOUR_USERNAME/scroll-tracker.git
   git push -u origin main
   ```

## 🌐 Step 2: Deploy Server to Render.com (FREE)

1. **Go to [Render.com](https://render.com) and sign up**

2. **Create a new Web Service:**
   - Connect your GitHub repository
   - Select the `server` folder as root directory
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Set Environment Variables in Render Dashboard:**
   ```
   NODE_ENV=production
   MONGODB_URI=your_mongodb_atlas_connection_string
   GROQ_API_KEY=your_groq_api_key
   JWT_SECRET=your_secure_jwt_secret
   PORT=4000
   ```

4. **Your server will be deployed at:**
   `https://YOUR_APP_NAME.onrender.com`

## 🏪 Step 3: Prepare Extension for Chrome Web Store

### Update Extension Configuration

1. **Update manifest.json version if needed**
2. **Create extension icons** (16x16, 48x48, 128x128)
3. **Create promotional images:**
   - Small promotional tile: 440x280
   - Large promotional tile: 920x680
   - Screenshots: 1280x800 or 640x400

### Package Extension
```bash
# Create a ZIP file of the extension folder
# Include: manifest.json, popup.html, popup.js, background.js, content.js, icon.svg
```

## 🎪 Step 4: Chrome Web Store Publication

1. **Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)**

2. **Pay the $5 developer registration fee**

3. **Create a new item:**
   - Upload your ZIP file
   - Fill in the store listing:
     - Name: "Scroll Tracker - Playful Analytics"
     - Summary: "Track your scrolling habits and discover fun analogies about your digital activity!"
     - Description: [Detailed description]
     - Category: "Productivity"
     - Language: "English"

4. **Upload promotional images and screenshots**

5. **Set privacy policy** (required for extensions that collect data)

6. **Submit for review**

## 🔧 Step 5: Post-Deployment Configuration

### Update Extension with Production URL

1. **Get your Render.com URL** (e.g., `https://scroll-tracker-api.onrender.com`)

2. **Update the extension's background.js** - already configured with:
   ```javascript
   API_BASE_URL: 'https://scroll-tracker-api.onrender.com'
   ```

3. **Test the extension** with the production server

### Enable CORS for Extension

In your server deployment, add your extension ID to CORS:
```javascript
// Will be updated after you get the Chrome extension ID
```

## 📊 Step 6: MongoDB Atlas Setup (FREE)

1. **Go to [MongoDB Atlas](https://cloud.mongodb.com)**
2. **Create a free cluster**
3. **Add database user**
4. **Whitelist IP addresses** (0.0.0.0/0 for Render.com)
5. **Get connection string** and add to Render environment variables

## 🔑 Step 7: Get API Keys

### Groq API (FREE)
1. Go to [console.groq.com](https://console.groq.com)
2. Create account and get API key
3. Add to Render environment variables

## 🚦 Step 8: Testing & Monitoring

### Test Checklist:
- [ ] Extension loads in Chrome
- [ ] Scroll tracking works on websites
- [ ] Analogies generate successfully
- [ ] Data syncs to server
- [ ] No console errors

### Monitoring:
- Use Render.com dashboard for server logs
- Monitor Chrome extension errors in Developer Console
- Set up basic analytics in MongoDB

## 🎉 Completion Steps

1. **Server deployed** ✅ `https://YOUR_APP.onrender.com`
2. **Extension published** ✅ Chrome Web Store
3. **Database configured** ✅ MongoDB Atlas
4. **APIs working** ✅ Groq integration
5. **End-to-end testing** ✅ Complete workflow

## 💡 Pro Tips

- **Free Tier Limitations:**
  - Render.com free tier spins down after 15 minutes of inactivity
  - First request after spin-down will be slower (cold start)
  - Consider upgrading if you get significant users

- **Chrome Web Store Review:**
  - Usually takes 1-3 business days
  - Make sure all permissions are justified
  - Provide clear privacy policy

- **Updates:**
  - Server updates deploy automatically via GitHub
  - Extension updates require new ZIP upload to Chrome Web Store
