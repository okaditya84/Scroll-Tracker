// Background service worker
class BackgroundService {
  constructor() {
    // Configuration for API endpoints
    this.config = {
      API_BASE_URL: 'https://scroll-tracker-api.onrender.com',
      // Fallback for development 
      FALLBACK_URL: 'http://localhost:4000'
    };
    this.init();
  }

  init() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener(() => {
      this.setupInitialData();
    });

    // Handle messages from content scripts and popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Periodic data aggregation
    this.startPeriodicTasks();
  }

  async setupInitialData() {
    const defaultSettings = {
      enableTracking: true,
      syncToServer: true,
      showNotifications: true,
      analogyLevel: 'creative', // basic, creative, scientific
      theme: 'dark'
    };

    await chrome.storage.local.set({ 
      settings: defaultSettings,
      installDate: Date.now()
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'generateAnalogy':
          const analogy = await this.generateAnalogy(request.metrics);
          sendResponse({ success: true, analogy });
          break;
          
        case 'syncData':
          const result = await this.syncToServer();
          sendResponse({ success: true, result });
          break;
          
        case 'getAggregatedStats':
          const stats = await this.getAggregatedStats();
          sendResponse({ success: true, stats });
          break;

        case 'authenticate':
          const authResult = await this.authenticateUser(request.email, request.password, request.action);
          sendResponse(authResult);
          break;

        case 'getUserProfile':
          const profile = await this.getUserProfile(request.token);
          sendResponse(profile);
          break;

        case 'getHistoricalData':
          const historical = await this.getHistoricalData(request.period, request.token);
          sendResponse(historical);
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background service error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async generateAnalogy(metrics) {
    try {
      console.log('🎯 Background: Generating analogy for metrics:', metrics);
      
      const response = await fetch(`${this.config.API_BASE_URL}/api/analogy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metrics)
      });

      console.log('📡 Background: Server response status:', response.status);

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const serverResponse = await response.json();
      console.log('📦 Background: Server response data:', serverResponse);

      // Server returns { success: true, analogy: {...} }
      // We need to return just the analogy data
      if (serverResponse.success && serverResponse.analogy) {
        console.log('✅ Background: Successfully extracted analogy data');
        return serverResponse.analogy;
      } else {
        console.log('❌ Background: Server response missing analogy data');
        throw new Error('Server response missing analogy data');
      }
    } catch (error) {
      console.error('❌ Background: Analogy generation failed:', error);
      // Fallback to simple analogy if server is down
      return this.generateFallbackAnalogy(metrics);
    }
  }

  generateFallbackAnalogy(metrics) {
    const distance = metrics.totalScrollDistance * 0.000264583; // Convert pixels to meters
    const time = metrics.totalScrollTime / 1000; // Convert to seconds
    
    const analogies = [
      {
        type: 'distance',
        value: distance,
        comparison: distance > 1000 
          ? `You scrolled ${(distance/1000).toFixed(2)} kilometers - that's like walking to the next neighborhood!`
          : `You scrolled ${distance.toFixed(1)} meters - that's like crossing a football field!`,
        icon: '🏃‍♂️'
      },
      {
        type: 'time',
        value: time,
        comparison: time > 300 
          ? `You spent ${(time/60).toFixed(1)} minutes scrolling - enough time to meditate or do a quick workout!`
          : `You scrolled for ${time.toFixed(0)} seconds - that's a power scroll session!`,
        icon: '⏱️'
      }
    ];

    return {
      analogies,
      funFact: "Did you know? The average person scrolls the equivalent of the Statue of Liberty's height every day!",
      energy: `Your scrolling burned approximately ${(distance * 0.1).toFixed(2)} calories - that's like eating a single M&M!`
    };
  }

  async syncToServer() {
    try {
      const result = await chrome.storage.local.get(['scrollSessions', 'userToken']);
      if (!result.userToken || !result.scrollSessions) {
        return { message: 'No data to sync' };
      }

      const response = await fetch(`${this.config.API_BASE_URL}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.userToken}`
        },
        body: JSON.stringify({ sessions: result.scrollSessions })
      });

      return await response.json();
    } catch (error) {
      console.error('Sync failed:', error);
      return { error: 'Sync failed' };
    }
  }

  async getAggregatedStats() {
    const result = await chrome.storage.local.get(['scrollSessions']);
    const sessions = result.scrollSessions || [];
    
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalScrollDistance: 0,
        totalScrollTime: 0,
        averageSessionTime: 0,
        mostActiveDay: null
      };
    }

    const totalScrollDistance = sessions.reduce((sum, s) => sum + s.totalScrollDistance, 0);
    const totalScrollTime = sessions.reduce((sum, s) => sum + s.totalScrollTime, 0);
    const totalSessionTime = sessions.reduce((sum, s) => sum + (s.lastUpdated - s.startTime), 0);

    // Group by day for most active day
    const dayStats = {};
    sessions.forEach(session => {
      const day = new Date(session.startTime).toDateString();
      if (!dayStats[day]) {
        dayStats[day] = { distance: 0, time: 0, sessions: 0 };
      }
      dayStats[day].distance += session.totalScrollDistance;
      dayStats[day].time += session.totalScrollTime;
      dayStats[day].sessions += 1;
    });

    const mostActiveDay = Object.entries(dayStats)
      .sort(([,a], [,b]) => b.distance - a.distance)[0];

    return {
      totalSessions: sessions.length,
      totalScrollDistance,
      totalScrollTime,
      averageSessionTime: totalSessionTime / sessions.length,
      mostActiveDay: mostActiveDay ? {
        date: mostActiveDay[0],
        stats: mostActiveDay[1]
      } : null
    };
  }

  startPeriodicTasks() {
    // Aggregate stats every hour
    setInterval(async () => {
      await this.getAggregatedStats();
    }, 60 * 60 * 1000);

    // Clean old sessions (keep last 30 days)
    setInterval(async () => {
      const result = await chrome.storage.local.get(['scrollSessions']);
      const sessions = result.scrollSessions || [];
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      const recentSessions = sessions.filter(s => s.startTime > thirtyDaysAgo);
      await chrome.storage.local.set({ scrollSessions: recentSessions });
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  async authenticateUser(email, password, action) {
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/api/auth/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();
      
      if (result.success) {
        // Store user token
        await chrome.storage.local.set({ userToken: result.token });
      }
      
      return result;
    } catch (error) {
      console.error('Authentication error:', error);
      return { success: false, error: 'Authentication failed. Check your connection.' };
    }
  }

  async getUserProfile(token) {
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/api/analytics/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Profile fetch error:', error);
      return { success: false, error: 'Failed to fetch profile' };
    }
  }

  async getHistoricalData(period, token) {
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/api/analytics/${period}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Historical data error:', error);
      return { success: false, error: 'Failed to fetch historical data' };
    }
  }
}

// Initialize background service
new BackgroundService();
