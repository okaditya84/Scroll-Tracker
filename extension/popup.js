// Popup JavaScript for the extension
class PopupController {
  constructor() {
    this.currentTab = 'stats';
    this.currentMetrics = {};
    this.settings = {};
    this.init();
  }

  async init() {
    console.log('PopupController initializing...');
    await this.loadSettings();
    this.attachEventListeners();
    this.initTabs();
    // Load stored data first, then try to refresh from content script
    await this.loadStoredData();
    await this.refreshData();
    this.startAutoRefresh();
    console.log('PopupController initialized successfully');
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['settings', 'userToken']);
      this.settings = result.settings || {
        enableTracking: true,
        syncToServer: true,
        showNotifications: true,
        analogyLevel: 'creative',
        theme: 'dark'
      };
      this.userToken = result.userToken;
      console.log('Settings loaded:', this.settings);
      console.log('User token:', this.userToken ? 'Present' : 'Not found');
      this.updateSettingsUI();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  attachEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Stats buttons
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshData();
      });
    }

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetCurrentSession();
      });
    }

    const debugBtn = document.getElementById('debugBtn');
    if (debugBtn) {
      debugBtn.addEventListener('click', () => {
        this.debugScrollTracker();
      });
    }

    // Analogy generation button
    const generateAnalogyBtn = document.getElementById('generateAnalogyBtn');
    if (generateAnalogyBtn) {
      generateAnalogyBtn.addEventListener('click', () => {
        console.log('🎯 Manual analogy generation requested');
        this.loadAnalogies();
      });
    }

    // Settings toggles
    document.querySelectorAll('.toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        this.toggleSetting(e.currentTarget.id);
      });
    });

    // Auth buttons
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        this.handleAuth('login');
      });
    }

    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
      registerBtn.addEventListener('click', () => {
        this.handleAuth('register');
      });
    }
  }

  initTabs() {
    this.switchTab('stats');
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    this.currentTab = tabName;

    // Load tab-specific data
    if (tabName === 'analogies') {
      this.loadAnalogies();
    }
  }

  async refreshData() {
    try {
      console.log('🔄 Refreshing scroll data...');
      
      // Get current tab and send message to content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('📄 Current tab:', tab.url);
      
      // Check if tab URL is valid for content script injection
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        console.log('⚠️ Cannot track on this page type');
        this.loadStoredData();
        this.showNotification('Please visit a regular webpage to track scrolling', 'info');
        return;
      }
      
      try {
        console.log('📡 Requesting metrics from content script...');
        // Try to get live data from content script
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getMetrics' });
        console.log('📊 Live metrics received:', response);
        
        if (response && (response.totalScrollDistance > 0 || response.scrollEvents > 0 || response.sessionDuration > 0)) {
          this.currentMetrics = response;
          this.updateStatsDisplay();
          this.showNotification(`Live data: ${response.totalScrollDistance?.toFixed(0) || 0}px scrolled`, 'success');
          return;
        } else {
          console.log('📊 No live scroll data detected');
        }
      } catch (messageError) {
        console.log('❌ Content script not responding:', messageError.message);
      }
      
      // Fallback to stored data
      console.log('📂 Loading stored data as fallback...');
      await this.loadStoredData();
      if (this.currentMetrics.totalScrollDistance > 0) {
        this.showNotification(`Stored data: ${this.currentMetrics.totalScrollDistance}px`, 'info');
      } else {
        this.showNotification('Start scrolling to see stats!', 'info');
      }
    } catch (error) {
      console.error('❌ Error refreshing data:', error);
      await this.loadStoredData();
      this.showNotification('Loading offline data', 'info');
    }
  }

  async loadStoredData() {
    try {
      console.log('📂 Loading stored scroll data...');
      const result = await chrome.storage.local.get(['scrollSessions']);
      const sessions = result.scrollSessions || [];
      
      console.log('📊 Found stored sessions:', sessions.length);
      
      if (sessions.length > 0) {
        // Get the most recent session or aggregate data
        const latestSession = sessions[sessions.length - 1];
        console.log('📈 Latest session data:', latestSession);
        
        this.currentMetrics = {
          totalScrollDistance: latestSession.totalScrollDistance || 0,
          totalScrollTime: latestSession.totalScrollTime || 0,
          scrollEvents: latestSession.scrollEvents?.length || 0,
          averageScrollSpeed: latestSession.averageScrollSpeed || 0,
          sessionDuration: latestSession.sessionDuration || 0
        };
      } else {
        console.log('📝 No stored scroll sessions found');
        // No stored data, use defaults
        this.currentMetrics = {
          totalScrollDistance: 0,
          totalScrollTime: 0,
          scrollEvents: 0,
          averageScrollSpeed: 0,
          sessionDuration: 0
        };
      }
      
      console.log('📊 Current metrics set to:', this.currentMetrics);
      this.updateStatsDisplay();
    } catch (error) {
      console.error('❌ Error loading stored data:', error);
      // Use default metrics on error
      this.currentMetrics = {
        totalScrollDistance: 0,
        totalScrollTime: 0,
        scrollEvents: 0,
        averageScrollSpeed: 0,
        sessionDuration: 0
      };
      this.updateStatsDisplay();
    }
  }

  updateStatsDisplay() {
    const metrics = this.currentMetrics;
    
    // Update basic stats
    document.getElementById('scrollDistance').textContent = 
      `${metrics.totalScrollDistance?.toFixed(0) || 0} px`;
    
    document.getElementById('scrollTime').textContent = 
      `${(metrics.totalScrollTime / 1000)?.toFixed(1) || 0}s`;
    
    document.getElementById('scrollSpeed').textContent = 
      `${metrics.averageScrollSpeed?.toFixed(0) || 0} px/s`;
    
    document.getElementById('sessionDuration').textContent = 
      `${(metrics.sessionDuration / 1000)?.toFixed(0) || 0}s`;
    
    document.getElementById('scrollEvents').textContent = 
      `${metrics.scrollEvents || 0}`;

    // Update progress bar (example: daily goal of 10000px)
    const dailyGoal = 10000;
    const progress = Math.min((metrics.totalScrollDistance || 0) / dailyGoal * 100, 100);
    document.getElementById('progressFill').style.width = `${progress}%`;
  }

  async loadAnalogies() {
    const analogyContent = document.getElementById('analogyContent');
    
    console.log('🎯 loadAnalogies called with metrics:', this.currentMetrics);
    
    // Check if user is logged in before allowing analogy generation
    if (!this.userToken) {
      console.log('🔐 User not logged in, showing auth prompt');
      analogyContent.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 15px;">🔐</div>
          <h3 style="color: #ff6b6b; margin-bottom: 10px;">Login Required</h3>
          <p style="margin-bottom: 15px;">Please log in to generate AI-powered analogies!</p>
          <button class="btn-primary" id="goToLoginBtn">
            Go to Login
          </button>
        </div>
      `;
      
      // Add event listener for the login button
      const goToLoginBtn = document.getElementById('goToLoginBtn');
      if (goToLoginBtn) {
        goToLoginBtn.addEventListener('click', () => {
          this.switchTab('settings');
        });
      }
      
      return;
    }
    
    if (!this.currentMetrics.totalScrollDistance || this.currentMetrics.totalScrollDistance < 50) {
      console.log('❌ Insufficient scroll distance, showing placeholder');
      analogyContent.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <p>Start scrolling more to see fun analogies!</p>
          <div style="font-size: 24px; margin: 10px 0;">📜</div>
          <p style="font-size: 12px; opacity: 0.8;">Minimum 50px scroll distance needed</p>
        </div>
      `;
      return;
    }

    console.log('⏳ Showing loading state and requesting analogies...');
    analogyContent.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Generating creative analogies...</p>
        <p style="font-size: 12px; opacity: 0.8; margin-top: 10px;">
          Distance: ${Math.round(this.currentMetrics.totalScrollDistance)}px
        </p>
      </div>
    `;

    try {
      console.log('📤 Sending message to background script with metrics:', this.currentMetrics);
      const response = await chrome.runtime.sendMessage({
        action: 'generateAnalogy',
        metrics: this.currentMetrics
      });

      console.log('📥 Received response from background script:', response);
      console.log('📥 Response type:', typeof response);
      console.log('📥 Response keys:', response ? Object.keys(response) : 'No response');

      if (response && response.success && response.analogy) {
        console.log('✅ Success! Displaying analogies...');
        console.log('🎭 Analogy data to display:', response.analogy);
        this.displayAnalogies(response.analogy);
      } else if (response && !response.success) {
        console.log('❌ Response indicates failure:', response);
        throw new Error(response.error || 'Server reported failure');
      } else if (response && response.analogies) {
        // Handle case where response is the analogy data directly
        console.log('✅ Direct analogy data received, displaying...');
        console.log('🎭 Direct analogy data:', response);
        this.displayAnalogies(response);
      } else {
        console.log('❌ Unexpected response format:', response);
        throw new Error('Unexpected response format from background script');
      }
    } catch (error) {
      console.error('💥 Error generating analogies:', error);
      console.log('🔄 Falling back to local analogies...');
      
      // Show error message with retry option
      analogyContent.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 32px; margin-bottom: 10px;">⚠️</div>
          <h4 style="color: #ff6b6b; margin-bottom: 10px;">Server Connection Issue</h4>
          <p style="font-size: 12px; margin-bottom: 15px;">
            ${error.message || 'Failed to connect to AI service'}
          </p>
          <button class="btn-primary" id="retryAnalogyBtn" style="margin-right: 10px;">
            🔄 Retry
          </button>
          <button class="btn-secondary" id="showFallbackBtn">
            📝 Show Basic Analogies
          </button>
        </div>
      `;
      
      // Add retry functionality
      const retryBtn = document.getElementById('retryAnalogyBtn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          console.log('🔄 User requested retry');
          this.loadAnalogies();
        });
      }
      
      // Add fallback option
      const fallbackBtn = document.getElementById('showFallbackBtn');
      if (fallbackBtn) {
        fallbackBtn.addEventListener('click', () => {
          console.log('📝 User requested fallback analogies');
          this.displayFallbackAnalogies();
        });
      }
    }
  }

  displayAnalogies(analogyData) {
    console.log('🎨 displayAnalogies called with data:', analogyData);
    console.log('🎨 Data type:', typeof analogyData);
    console.log('🎨 Data keys:', analogyData ? Object.keys(analogyData) : 'No data');
    console.log('🎨 Analogies array:', analogyData?.analogies);
    
    const analogyContent = document.getElementById('analogyContent');
    
    if (!analogyContent) {
      console.error('❌ analogyContent element not found in DOM!');
      return;
    }
    
    let html = '';
    
    // Check for analogies array
    if (analogyData && analogyData.analogies && Array.isArray(analogyData.analogies)) {
      console.log(`📝 Processing ${analogyData.analogies.length} analogies`);
      analogyData.analogies.forEach((analogy, index) => {
        const icon = analogy.icon || '🎯';
        const comparison = analogy.comparison || 'No comparison available';
        const borderColor = ['#4CAF50', '#2196F3', '#FF6B6B'][index % 3];
        
        console.log(`📝 Adding analogy ${index + 1}:`, { icon, comparison });
        
        html += `
          <div class="analogy-item pulse" style="border-left-color: ${borderColor};">
            <div class="analogy-icon">${icon}</div>
            <div class="analogy-text">${comparison}</div>
          </div>
        `;
      });
    } else {
      console.log('⚠️ No analogies array found in data, checking for direct properties');
      console.log('⚠️ analogyData structure:', JSON.stringify(analogyData, null, 2));
      
      // Handle case where analogies might be direct properties
      if (analogyData && analogyData.comparison) {
        html += `
          <div class="analogy-item pulse">
            <div class="analogy-icon">${analogyData.icon || '🎯'}</div>
            <div class="analogy-text">${analogyData.comparison}</div>
          </div>
        `;
      }
    }

    // Add fun fact if available
    if (analogyData.funFact) {
      console.log('💡 Adding fun fact');
      html += `
        <div class="fun-fact">
          💡 ${analogyData.funFact}
        </div>
      `;
    }

    // Add energy comparison if available
    if (analogyData.energy) {
      console.log('⚡ Adding energy comparison');
      html += `
        <div class="analogy-item" style="border-left-color: #FF6B6B;">
          <div class="analogy-icon">⚡</div>
          <div class="analogy-text">${analogyData.energy}</div>
        </div>
      `;
    }

    // Add physics data if available
    if (analogyData.physics) {
      console.log('🔬 Adding physics data');
      html += `
        <div class="analogy-item" style="border-left-color: #9C27B0;">
          <div class="analogy-icon">🔬</div>
          <div class="analogy-text">
            Physics: ${analogyData.physics.explanation || 'Minimal energy used'}
          </div>
        </div>
      `;
    }

    // Add metadata if available (for debugging)
    if (analogyData.metadata && analogyData.metadata.distanceInMeters) {
      console.log('📊 Adding metadata info');
      html += `
        <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 11px; opacity: 0.8;">
          📊 Metrics: ${analogyData.metadata.distanceInMeters}m in ${analogyData.metadata.timeInSeconds}s
        </div>
      `;
    }

    // If no content was generated, show an error
    if (!html.trim()) {
      console.log('❌ No content generated, showing error message');
      html = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 32px; margin-bottom: 10px;">😅</div>
          <p>Analogy generation failed</p>
          <p style="font-size: 12px; opacity: 0.8; margin-top: 10px;">
            The AI service returned an unexpected format
          </p>
          <button class="btn-secondary" id="showFallbackFromDisplayBtn" style="margin-top: 10px;">
            📝 Show Basic Analogies
          </button>
        </div>
      `;
      
      analogyContent.innerHTML = html;
      
      // Add event listener for fallback button
      const fallbackBtn = document.getElementById('showFallbackFromDisplayBtn');
      if (fallbackBtn) {
        fallbackBtn.addEventListener('click', () => {
          this.displayFallbackAnalogies();
        });
      }
      
      return;
    }

    console.log('🖼️ Setting HTML content:', html.length, 'characters');
    analogyContent.innerHTML = html;
    console.log('✅ displayAnalogies completed');
  }

  displayFallbackAnalogies() {
    const metrics = this.currentMetrics;
    const distance = metrics.totalScrollDistance * 0.000264583; // Convert to meters
    const time = metrics.totalScrollTime / 1000; // Convert to seconds

    const analogyContent = document.getElementById('analogyContent');
    
    analogyContent.innerHTML = `
      <div class="analogy-item pulse">
        <div class="analogy-icon">🏃‍♂️</div>
        <div class="analogy-text">
          You scrolled ${distance.toFixed(1)} meters - that's like ${distance > 100 ? 'running across a football field' : 'walking across a room'}!
        </div>
      </div>
      
      <div class="analogy-item pulse">
        <div class="analogy-icon">⏱️</div>
        <div class="analogy-text">
          ${time > 60 ? `${(time/60).toFixed(1)} minutes of scrolling` : `${time.toFixed(0)} seconds of scrolling`} - 
          ${time > 300 ? 'enough time for a coffee break!' : 'a quick scroll session!'}
        </div>
      </div>
      
      <div class="fun-fact">
        💡 Did you know? The average person scrolls enough to climb Mount Everest every year!
      </div>
      
      <div class="analogy-item" style="border-left-color: #FF6B6B;">
        <div class="analogy-icon">⚡</div>
        <div class="analogy-text">
          Your scrolling burned approximately ${(distance * 0.1).toFixed(3)} calories!
        </div>
      </div>
    `;
  }

  toggleSetting(settingId) {
    const toggle = document.getElementById(settingId);
    toggle.classList.toggle('active');
    
    const isActive = toggle.classList.contains('active');
    this.settings[settingId] = isActive;
    
    this.saveSettings();
    this.showNotification(`${settingId} ${isActive ? 'enabled' : 'disabled'}`, 'success');
  }

  updateSettingsUI() {
    Object.entries(this.settings).forEach(([key, value]) => {
      const toggle = document.getElementById(key);
      if (toggle) {
        if (value) {
          toggle.classList.add('active');
        } else {
          toggle.classList.remove('active');
        }
      }
    });

    // Update auth UI
    if (this.userToken) {
      document.getElementById('authContent').innerHTML = `
        <div style="text-align: center;">
          <p style="margin-bottom: 15px;">✅ Logged in successfully!</p>
          <button class="btn-secondary" id="logoutBtn">Logout</button>
        </div>
      `;
      
      document.getElementById('logoutBtn').addEventListener('click', () => {
        this.logout();
      });
    } else {
      // Ensure auth form is present for non-logged-in users
      const authContent = document.getElementById('authContent');
      if (!authContent.querySelector('#email')) {
        authContent.innerHTML = `
          <div class="auth-form">
            <div class="form-group">
              <input type="email" id="email" placeholder="Email">
            </div>
            <div class="form-group">
              <input type="password" id="password" placeholder="Password">
            </div>
            <button class="btn-primary" id="loginBtn">Login</button>
            <button class="btn-secondary" id="registerBtn">Register</button>
          </div>
        `;
        
        // Attach event listeners for auth buttons
        document.getElementById('loginBtn').addEventListener('click', () => {
          this.handleAuth('login');
        });
        document.getElementById('registerBtn').addEventListener('click', () => {
          this.handleAuth('register');
        });
      }
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({ settings: this.settings });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  async handleAuth(action) {
    const emailElement = document.getElementById('email');
    const passwordElement = document.getElementById('password');
    
    if (!emailElement || !passwordElement) {
      this.showNotification('Auth form not found. Please refresh the extension.', 'error');
      console.error('Email or password element not found in DOM');
      return;
    }
    
    const email = emailElement.value;
    const password = passwordElement.value;

    if (!email || !password) {
      this.showNotification('Please fill in all fields', 'error');
      return;
    }

    // Show loading state
    this.showNotification(`${action}ing...`, 'info');

    try {
      console.log(`Attempting ${action} with email:`, email);
      const response = await fetch(`http://localhost:4000/api/auth/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response body:', result);

      if (response.ok) {
        this.userToken = result.token;
        await chrome.storage.local.set({ userToken: result.token });
        this.showNotification(`${action} successful!`, 'success');
        this.updateSettingsUI();
        
        // If user is currently on analogies tab, reload it to show analogies
        if (this.currentTab === 'analogies') {
          this.loadAnalogies();
        }
        
        // Clear form (with null checks)
        const emailElement = document.getElementById('email');
        const passwordElement = document.getElementById('password');
        if (emailElement) emailElement.value = '';
        if (passwordElement) passwordElement.value = '';
      } else {
        console.error(`${action} failed:`, result);
        const errorMessage = result.message || result.error || `${action} failed`;
        this.showNotification(errorMessage, 'error');
      }
    } catch (error) {
      console.error('Auth error:', error);
      this.showNotification(`Connection error: ${error.message}. Check if server is running.`, 'error');
    }
  }

  async logout() {
    this.userToken = null;
    await chrome.storage.local.remove(['userToken']);
    this.showNotification('Logged out successfully', 'success');
    
    // Reset auth UI
    document.getElementById('authContent').innerHTML = `
      <div class="auth-form">
        <div class="form-group">
          <input type="email" id="email" placeholder="Email">
        </div>
        <div class="form-group">
          <input type="password" id="password" placeholder="Password">
        </div>
        <button class="btn-primary" id="loginBtn">Login</button>
        <button class="btn-secondary" id="registerBtn">Register</button>
      </div>
    `;
    
    // Re-attach event listeners
    document.getElementById('loginBtn').addEventListener('click', () => {
      this.handleAuth('login');
    });
    document.getElementById('registerBtn').addEventListener('click', () => {
      this.handleAuth('register');
    });
  }

  async resetCurrentSession() {
    try {
      // Clear current session data
      await chrome.storage.local.set({ scrollSessions: [] });
      
      // Refresh display
      this.currentMetrics = {
        totalScrollDistance: 0,
        totalScrollTime: 0,
        scrollEvents: 0,
        averageScrollSpeed: 0,
        sessionDuration: 0
      };
      
      this.updateStatsDisplay();
      this.showNotification('Session reset!', 'success');
    } catch (error) {
      console.error('Error resetting session:', error);
      this.showNotification('Failed to reset session', 'error');
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification show ${type}`;
    
    // Clear any existing timeout
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    
    // Set timeout based on type
    const duration = type === 'error' ? 5000 : 3000;
    this.notificationTimeout = setTimeout(() => {
      notification.classList.remove('show');
    }, duration);
  }

  async debugScrollTracker() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check storage
      const result = await chrome.storage.local.get(['scrollSessions']);
      console.log('🐛 Debug - Storage data:', result);
      
      // Test content script communication
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getMetrics' });
        console.log('🐛 Debug - Content script response:', response);
        this.showNotification('Check console for debug info', 'info');
      } catch (error) {
        console.log('🐛 Debug - Content script error:', error);
        this.showNotification('Content script not responding - check console', 'error');
      }
    } catch (error) {
      console.error('🐛 Debug error:', error);
      this.showNotification('Debug failed - check console', 'error');
    }
  }

  startAutoRefresh() {
    // Auto-refresh every 2 seconds when stats tab is active (more responsive)
    setInterval(() => {
      if (this.currentTab === 'stats') {
        this.refreshData();
      }
    }, 2000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
