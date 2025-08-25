# 🎯 Scroll Tracker - Production Ready Chrome Extension

A comprehensive scroll tracking browser extension with AI-powered insights, user authentication, and detailed analytics.

## 🚀 Features

### Core Features
- **Real-time scroll tracking** - Track scrolling distance, speed, and patterns
- **Cross-session persistence** - Data saved locally and synced to cloud
- **Multi-tab support** - Independent tracking per browser tab
- **Intelligent session management** - Automatic session detection and management

### AI-Powered Insights
- **Creative analogies** - AI generates fun comparisons for your scrolling behavior
- **Physics calculations** - Real-world energy and force calculations
- **LLM-powered knowledge** - Rich analogies using Groq's LLaMA models
- **Fallback responses** - Graceful degradation when AI services are unavailable

### User Authentication & Profiles
- **Secure registration/login** - JWT-based authentication
- **User profiles** - Personal stats and achievements
- **Data synchronization** - Seamless data sync across devices
- **Privacy-first design** - Encrypted data storage

### Advanced Analytics
- **Time-based analysis** - View stats by current session, today, week, or month
- **Historical trends** - Track progress over time
- **Achievement system** - Unlock badges for milestones
- **Detailed breakdowns** - Daily patterns, most active hours, top websites

### Professional UI/UX
- **Modern design** - Clean, responsive interface with dark theme
- **Intuitive navigation** - Tab-based organization
- **Real-time updates** - Live data refresh every 2 seconds
- **Error handling** - Comprehensive error messages and fallbacks
- **Loading states** - Smooth loading animations and feedback

### 🖱️ Smart Scroll Tracking
- **Real-time monitoring** of scroll distance, time, and patterns
- **Session-based analytics** with detailed metrics
- **Cross-website tracking** with privacy-first approach
- **Offline-first** with automatic cloud sync when connected

### 🎭 AI-Powered Analogies
- **Creative comparisons** powered by Groq Cloud LLM
- **Physics calculations** for energy and force equivalents
- **Mood-based insights** based on scrolling patterns
- **Rich knowledge base** using LLaMA's training data

### 📊 Beautiful Analytics
- **Interactive dashboard** with real-time stats
- **Progress tracking** with daily goals and streaks
- **Leaderboards** and achievements system
- **Data visualization** with charts and heatmaps

### 🔐 Privacy & Security
- **Optional authentication** - works anonymously or with account
- **Local-first storage** with optional cloud backup
- **No tracking scripts** - your data stays private
- **GDPR compliant** with data export/import

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- MongoDB Atlas account (free tier)
- Groq Cloud API key (free tier)
- Chrome/Edge browser for extension

### 1. Clone & Setup
```bash
git clone <your-repo>
cd "Scroll Tracker"
```

### 2. Environment Setup
Edit `.env` file with your credentials:
```env
# MongoDB Atlas (free tier)
MONGO_URI="mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/scrolltracker"

# Groq Cloud (free tier)
GROQ_API_KEY="your_groq_api_key_here"
GROQ_MODEL="llama-3.3-70b-versatile"

# JWT Secret (change this!)
JWT_SECRET="your_secure_random_string"

PORT=4000
```

### 3. Install Dependencies
```bash
cd server
npm install
```

### 4. Start the Server
```bash
npm start
# or for development
npm run dev
```

### 5. Load the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension` folder
4. The Scroll Tracker icon should appear in your toolbar!

## 🏗️ Architecture

### Frontend (Browser Extension)
- **Manifest V3** for modern Chrome compatibility
- **Content Script**: Tracks scrolling on all websites
- **Background Service Worker**: Handles AI requests and data sync
- **Popup Interface**: Beautiful dashboard with real-time stats

### Backend (Node.js + Express)
- **REST API** for data management and AI integration
- **MongoDB Atlas** for scalable data storage
- **LangChain + Groq** for AI-powered analogies
- **LLM Knowledge Base** for rich, creative comparisons

### AI Pipeline
```
Scroll Data → Analogy Agent → LLM Processing → Creative Analogies
     ↓              ↓              ↓              ↓
Physics Calc → Knowledge Base → Enhanced Output → Display
```

## 🧠 AI Agent

### AnalogyAgent
- Generates creative comparisons using Groq's LLaMA models
- Calculates physics equivalents (force, energy, calories)
- Mood analysis based on scrolling patterns
- Multiple themed outputs (creative, scientific, humorous)
- Rich knowledge base for accurate analogies

## 📱 Extension Usage

### Basic Tracking
1. **Install and start browsing** - tracking begins automatically
2. **Click the extension icon** to see real-time stats
3. **View analogies** in the "Analogies" tab for fun comparisons
4. **Adjust settings** in the "Settings" tab

### Advanced Features
- **Create an account** for cloud sync and advanced analytics
- **Export your data** for backup or analysis
- **Compete on leaderboards** with other users
- **Unlock achievements** as you scroll more

### Example Analogies
- "You scrolled 2.3 kilometers today - that's like walking to the corner store and back!"
- "Your scrolling burned 0.05 calories - equivalent to blinking 40 times!"
- "You made 247 scroll gestures - the same as petting a cat for 5 minutes!"

## 🛠️ Development

### Project Structure
```
Scroll Tracker/
├── extension/           # Browser extension files
│   ├── manifest.json   # Extension configuration
│   ├── content.js      # Scroll tracking logic
│   ├── background.js   # Service worker
│   ├── popup.html      # Dashboard UI
│   └── popup.js        # Dashboard logic
├── server/             # Backend API
│   ├── agents/         # AI agents
│   ├── models/         # Database schemas
│   ├── routes/         # API endpoints
│   └── server.js       # Main server file
└── .env               # Environment variables
```

### API Endpoints

#### Authentication
```
POST /api/auth/register  # Create account
POST /api/auth/login     # Login
GET  /api/auth/profile   # Get profile
```

#### Sessions
```
POST /api/sessions       # Save scroll session
GET  /api/sessions       # Get user sessions
GET  /api/sessions/stats # Get statistics
```

#### AI & Analogies
```
POST /api/analogy        # Generate analogies using LLM knowledge
POST /api/analogy/physics  # Physics calculations
POST /api/analogy/themed   # Multiple themed analogies
POST /api/analogy/mood     # Mood-based analogies
POST /api/analogy/batch    # Batch processing
```

### Environment Variables
```env
# Required
MONGO_URI=              # MongoDB connection string
GROQ_API_KEY=          # Groq Cloud API key
JWT_SECRET=            # JWT signing secret

# Optional
PORT=4000              # Server port
GROQ_MODEL=            # Groq model name
NODE_ENV=development   # Environment
```

## 🔧 Configuration

### MongoDB Setup
1. Create free MongoDB Atlas account
2. Create a cluster and database
3. Get connection string and add to `.env`

### Groq Cloud Setup
1. Sign up at console.groq.com
2. Generate API key
3. Add key to `.env` file

### Extension Permissions
The extension requests minimal permissions:
- `activeTab`: Read current page for scroll tracking
- `storage`: Store user preferences and data locally
- Host permissions for API communication

## 🎨 Customization

### Adding New Analogy Types
1. Extend `AnalogyAgent.js` with new prompt templates
2. Add corresponding UI elements in `popup.html`
3. Update the display logic in `popup.js`

### Custom Physics Calculations
1. Modify constants in `content.js`
2. Update physics prompts in `AnalogyAgent.js`
3. Add new comparison types

### UI Themes
1. Edit CSS in `popup.html` styles
2. Add theme toggle in settings
3. Store preference in extension storage

## 📊 Data & Privacy

### What We Track
- Scroll distance (pixels)
- Scroll time (milliseconds)
- Number of scroll events
- Website URLs (for categorization)
- Session timestamps

### What We DON'T Track
- Page content or text
- Personal information
- Keystrokes or clicks
- Private browsing sessions

### Data Storage
- **Local**: Chrome extension storage (always)
- **Cloud**: MongoDB Atlas (optional, with account)
- **Export**: JSON format available anytime

## 🎯 Roadmap

### Version 1.1
- [ ] Mobile app companion
- [ ] Team/family sharing features
- [ ] Weekly/monthly reports
- [ ] Integration with fitness trackers

### Version 1.2
- [ ] Machine learning pattern recognition
- [ ] Predictive scroll analytics
- [ ] Health break reminders
- [ ] Productivity insights

### Version 2.0
- [ ] Multi-browser support
- [ ] Advanced AI personalities
- [ ] Custom goal setting
- [ ] Social features

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and test thoroughly
4. **Commit**: `git commit -m 'Add amazing feature'`
5. **Push**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Development Setup
```bash
# Backend development
cd server
npm run dev  # Starts with nodemon

# Extension development
# Load unpacked extension in Chrome
# Changes to popup.* files require extension reload
# Changes to content.js require page refresh
```

## 🧪 Testing

### Manual Testing
1. Install extension in Chrome
2. Browse different websites
3. Check popup for real-time updates
4. Test API endpoints with Postman

### Automated Testing
```bash
cd server
npm test  # When tests are added
```

## ⚡ Performance

### Optimization Features
- Efficient scroll event throttling
- Smart caching of AI responses
- Minimal memory footprint
- Background processing for heavy calculations

### Monitoring
- Client-side performance tracking
- Server response time monitoring
- Database query optimization
- AI agent response caching

## 🚨 Troubleshooting

### Common Issues

**Extension not tracking:**
- Check if extension is enabled
- Refresh the page after installation
- Check browser console for errors

**API connection failed:**
- Verify server is running on port 4000
- Check firewall settings
- Confirm environment variables are set

**No analogies generated:**
- Verify Groq API key is correct
- Check internet connection
- Try refreshing the extension

**Database connection error:**
- Verify MongoDB URI format
- Check database credentials
- Ensure IP is whitelisted in Atlas

### Debug Mode
Set environment variable:
```bash
NODE_ENV=development
```
This enables detailed error messages and logging.

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **Groq Cloud** for fast LLM inference
- **MongoDB Atlas** for reliable database hosting
- **LangChain** for AI orchestration framework
- **Chrome Extensions API** for browser integration

## 💬 Support

- **GitHub Issues**: Bug reports and feature requests
- **Email**: [Your contact email]
- **Documentation**: Comprehensive guides in `/docs`

---

Made with ❤️ for digital wellness and playful analytics!

## 🎉 Fun Stats

Since you've read this far, here's a fun fact: The average person scrolls about 300 feet per day - that's roughly the height of the Statue of Liberty! 🗽

Start tracking your scrolling journey today and discover your own amazing analogies! 🚀
