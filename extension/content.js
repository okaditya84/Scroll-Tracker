// Content script for tracking scroll behavior
// Scroll Tracker Content Script

// Helper function to check if Chrome extension APIs are available
function isChromeApiAvailable() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (error) {
    return false;
  }
}

// Helper function to safely use Chrome storage
async function safeChromeStorageGet(keys) {
  if (!isChromeApiAvailable()) {
    throw new Error('Extension context invalidated');
  }
  return await chrome.storage.local.get(keys);
}

async function safeChromeStorageSet(data) {
  if (!isChromeApiAvailable()) {
    throw new Error('Extension context invalidated');
  }
  return await chrome.storage.local.set(data);
}

class ScrollTracker {
  constructor() {
    this.sessionData = {
      startTime: Date.now(),
      totalScrollDistance: 0,
      totalScrollTime: 0,
      scrollEvents: [],
      currentScrollStart: null,
      isScrolling: false,
      pageHeight: 0,
      viewportHeight: window.innerHeight
    };
    
    this.scrollTimer = null;
    this.init();
  }

  init() {
    this.updatePageHeight();
    this.attachScrollListeners();
    this.startSession();
    
    // Update page height on resize
    window.addEventListener('resize', () => {
      this.sessionData.viewportHeight = window.innerHeight;
      this.updatePageHeight();
    });

    // Handle page changes (SPA)
    this.observePageChanges();
  }

  updatePageHeight() {
    this.sessionData.pageHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
  }

  attachScrollListeners() {
    let lastScrollY = window.scrollY;
    let scrollStartTime = null;
    let isThrottled = false;

    const handleScroll = () => {
      // Throttle scroll events for performance
      if (isThrottled) return;
      isThrottled = true;
      setTimeout(() => { isThrottled = false; }, 16); // ~60fps

      const currentScrollY = window.scrollY;
      const currentTime = Date.now();

      if (!this.sessionData.isScrolling) {
        this.sessionData.isScrolling = true;
        this.sessionData.currentScrollStart = currentScrollY;
        scrollStartTime = currentTime;
        console.log('🚀 Scroll started at:', currentScrollY);
      }

      // Calculate distance
      const distance = Math.abs(currentScrollY - lastScrollY);
      if (distance > 0) {
        this.sessionData.totalScrollDistance += distance;
        console.log('📏 Total scroll distance:', this.sessionData.totalScrollDistance, 'px');
      }

      // Clear previous timer
      if (this.scrollTimer) {
        clearTimeout(this.scrollTimer);
      }

      // Set timer to detect scroll end
      this.scrollTimer = setTimeout(() => {
        if (this.sessionData.isScrolling) {
          const scrollEndTime = Date.now();
          const scrollDuration = scrollEndTime - scrollStartTime;
          
          this.sessionData.totalScrollTime += scrollDuration;
          this.sessionData.scrollEvents.push({
            startY: this.sessionData.currentScrollStart,
            endY: currentScrollY,
            distance: Math.abs(currentScrollY - this.sessionData.currentScrollStart),
            duration: scrollDuration,
            timestamp: scrollEndTime,
            url: window.location.href,
            title: document.title
          });

          this.sessionData.isScrolling = false;
          console.log('⏹️ Scroll ended. Total events:', this.sessionData.scrollEvents.length);
          console.log('📊 Session data:', {
            totalDistance: this.sessionData.totalScrollDistance,
            totalTime: this.sessionData.totalScrollTime,
            events: this.sessionData.scrollEvents.length
          });
          this.saveSessionData();
        }
      }, 150); // 150ms delay to detect scroll end

      lastScrollY = currentScrollY;
    };

    // Add multiple event listeners for better coverage
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleScroll, { passive: true });
    
    console.log('📡 Scroll listeners attached successfully');
  }

  observePageChanges() {
    // For SPAs, observe URL changes
    let currentUrl = window.location.href;
    
    const observer = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.updatePageHeight();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async saveSessionData() {
    try {
      // Check if extension context is still valid
      if (!isChromeApiAvailable()) {
        console.log('🔄 Extension context invalidated, skipping save');
        return;
      }

      // Get existing data using safe method
      const result = await safeChromeStorageGet(['scrollSessions']);
      const sessions = result.scrollSessions || [];
      
      // Update current session with proper ID
      const sessionIndex = sessions.findIndex(s => s.id === this.sessionId);
      const sessionData = {
        ...this.sessionData,
        id: this.sessionId,
        sessionId: this.sessionId, // Also add sessionId for server compatibility
        url: window.location.href,
        title: document.title,
        lastUpdated: Date.now()
      };

      if (sessionIndex >= 0) {
        sessions[sessionIndex] = sessionData;
      } else {
        sessions.push(sessionData);
      }

      // Keep only last 50 sessions to avoid storage bloat
      if (sessions.length > 50) {
        sessions.splice(0, sessions.length - 50);
      }

      await safeChromeStorageSet({ scrollSessions: sessions });
      console.log('💾 Session data saved:', sessionData);
      
      // Also save to server if user is authenticated (non-blocking)
      this.syncToServer(sessionData).catch(error => {
        console.log('⚠️ Server sync failed but continuing locally:', error.message);
      });
    } catch (error) {
      // Handle extension context invalidation gracefully
      if (error.message.includes('Extension context invalidated')) {
        console.log('🔄 Extension was reloaded, stopping content script');
        this.cleanup();
      } else {
        console.error('❌ Error saving scroll data:', error);
      }
    }
  }

  async syncToServer(sessionData) {
    try {
      // Check if extension context is still valid
      if (!isChromeApiAvailable()) {
        console.log('🔄 Extension context invalidated, skipping server sync');
        return;
      }

      const result = await safeChromeStorageGet(['userToken']);
      if (!result.userToken) {
        console.log('🔒 No user token found, skipping server sync');
        return;
      }

      console.log('🌐 Syncing data to server...', {
        distance: sessionData.totalScrollDistance,
        events: sessionData.scrollEvents?.length
      });

      const response = await fetch('http://localhost:4000/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.userToken}`
        },
        body: JSON.stringify(sessionData)
      });

      if (response.ok) {
        console.log('✅ Data synced to server successfully');
      } else {
        console.log('⚠️ Server sync failed with status:', response.status);
      }
    } catch (error) {
      console.log('❌ Server sync failed:', error.message);
    }
  }

  startSession() {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('🎬 New session started:', this.sessionId);
    this.saveSessionData();
  }

  getMetrics() {
    const sessionDuration = Date.now() - this.sessionData.startTime;
    
    // Always return the current local metrics regardless of sync status
    const metrics = {
      sessionDuration,
      totalScrollDistance: this.sessionData.totalScrollDistance,
      totalScrollTime: this.sessionData.totalScrollTime,
      scrollEvents: this.sessionData.scrollEvents.length,
      averageScrollSpeed: this.sessionData.totalScrollTime > 0 
        ? this.sessionData.totalScrollDistance / (this.sessionData.totalScrollTime / 1000) 
        : 0,
      pageHeight: this.sessionData.pageHeight,
      viewportHeight: this.sessionData.viewportHeight,
      currentUrl: window.location.href,
      currentTitle: document.title
    };
    
    console.log('📊 Current metrics requested:', metrics);
    return metrics;
  }

  cleanup() {
    console.log('🧹 Cleaning up scroll tracker...');
    
    // Stop auto-save interval
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }

    // Remove event listeners
    try {
      window.removeEventListener('scroll', this.scrollHandler);
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      window.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    } catch (error) {
      console.log('🔄 Some event listeners were already removed');
    }

    // Save final session data if possible
    try {
      if (isChromeApiAvailable()) {
        this.saveSessionData();
      }
    } catch (error) {
      console.log('🔄 Could not save final session data, extension context invalidated');
    }

    console.log('✅ Scroll tracker cleanup completed');
  }
}

// Initialize tracker with error handling
let scrollTracker;

function initializeTracker() {
  try {
    console.log('🔄 Initializing scroll tracker...');
    console.log('📄 Document ready state:', document.readyState);
    console.log('🌐 Current URL:', window.location.href);
    
    // Always try to initialize, regardless of document state
    scrollTracker = new ScrollTracker();
    console.log('✅ Scroll tracker initialized successfully');
    
    // Test scroll detection immediately
    window.addEventListener('scroll', () => {
      console.log('📜 Scroll event detected! ScrollY:', window.scrollY);
    }, { once: true, passive: true });
    
  } catch (error) {
    console.error('❌ Error initializing scroll tracker:', error);
    scrollTracker = null;
  }
}

// Initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTracker);
} else {
  initializeTracker();
}

// Global error handler for extension context invalidation
window.addEventListener('error', (event) => {
  if (event.error?.message?.includes('Extension context invalidated')) {
    console.log('🔄 Extension context invalidated detected globally, cleaning up...');
    if (scrollTracker) {
      scrollTracker.cleanup();
      scrollTracker = null;
    }
  }
});

// Also handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('Extension context invalidated')) {
    console.log('🔄 Extension context invalidated in promise, cleaning up...');
    if (scrollTracker) {
      scrollTracker.cleanup();
      scrollTracker = null;
    }
    event.preventDefault(); // Prevent the error from being logged to console
  }
});

// Also initialize on page focus (for SPAs)
window.addEventListener('focus', () => {
  if (!scrollTracker) {
    console.log('🔄 Reinitializing tracker on focus');
    initializeTracker();
  }
});

// Also reinitialize on navigation in SPAs
window.addEventListener('popstate', () => {
  console.log('Page navigation detected, reinitializing tracker');
  initializeTracker();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    // Check if extension context is still valid
    if (!isChromeApiAvailable()) {
      console.log('🔄 Extension context invalidated, cannot respond to message');
      sendResponse({
        error: 'Extension context invalidated',
        totalScrollDistance: 0,
        totalScrollTime: 0,
        scrollEvents: 0,
        averageScrollSpeed: 0,
        sessionDuration: 0
      });
      return true;
    }

    if (request.action === 'getMetrics') {
      const metrics = scrollTracker ? scrollTracker.getMetrics() : {
        totalScrollDistance: 0,
        totalScrollTime: 0,
        scrollEvents: 0,
        averageScrollSpeed: 0,
        sessionDuration: 0
      };
      sendResponse(metrics);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    
    // Handle extension context invalidation
    if (error.message?.includes('Extension context invalidated')) {
      console.log('🔄 Extension context invalidated in message handler');
      if (scrollTracker) {
        scrollTracker.cleanup();
        scrollTracker = null;
      }
    }
    
    sendResponse({
      error: error.message,
      totalScrollDistance: 0,
      totalScrollTime: 0,
      scrollEvents: 0,
      averageScrollSpeed: 0,
      sessionDuration: 0
    });
  }
  return true;
});

// Calculate physics constants for fun analogies
const PHYSICS_CONSTANTS = {
  AVERAGE_FINGER_FORCE: 1.5, // Newtons (average tap force)
  SCROLL_WHEEL_FORCE: 0.8, // Newtons per scroll wheel click
  SCREEN_FRICTION: 0.1, // Coefficient of friction between finger and screen
  PIXEL_TO_METER: 0.000264583, // 1 pixel ≈ 0.26mm at 96 DPI
  CALORIES_PER_JOULE: 0.000239, // 1 Joule = 0.000239 calories
  JOGGING_CALORIES_PER_MINUTE: 10 // Average calories burned jogging per minute
};

// Export constants for popup use
window.PHYSICS_CONSTANTS = PHYSICS_CONSTANTS;
