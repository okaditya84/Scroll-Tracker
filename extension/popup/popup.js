// Popup Script - Manages UI and user interactions
import { getStorageData, setStorageData } from '../utils/storage.js';
import { loginWithGoogle, loginWithEmail, logout, getUserProfile } from '../utils/auth.js';

// DOM Elements
let currentScreen = 'login';
let isTracking = false;
let userData = null;
let updateInterval = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');
  await initializePopup();
});

async function initializePopup() {
  // Check if user is logged in
  const storage = await getStorageData(['userId', 'accessToken', 'isTracking']);
  
  if (storage.userId && storage.accessToken) {
    // User is logged in
    userData = await getUserProfile(storage.accessToken);
    isTracking = storage.isTracking || false;
    showDashboard();
  } else {
    // Show login screen
    showLogin();
  }
  
  setupEventListeners();
}

function setupEventListeners() {
  // Login screen
  const googleSignInBtn = document.getElementById('googleSignInBtn');
  const emailSignUpBtn = document.getElementById('emailSignUpBtn');
  
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', handleGoogleSignIn);
  }
  
  if (emailSignUpBtn) {
    emailSignUpBtn.addEventListener('click', handleEmailSignUp);
  }
  
  // Dashboard screen
  const trackingToggle = document.getElementById('trackingToggle');
  const refreshInsight = document.getElementById('refreshInsight');
  const viewFullDashboard = document.getElementById('viewFullDashboard');
  const syncNowBtn = document.getElementById('syncNowBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  
  if (trackingToggle) {
    trackingToggle.addEventListener('click', handleTrackingToggle);
  }
  
  if (refreshInsight) {
    refreshInsight.addEventListener('click', handleRefreshInsight);
  }
  
  if (viewFullDashboard) {
    viewFullDashboard.addEventListener('click', handleViewFullDashboard);
  }
  
  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', handleSyncNow);
  }
  
  if (settingsBtn) {
    settingsBtn.addEventListener('click', handleSettings);
  }
}

function showLogin() {
  currentScreen = 'login';
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('dashboardScreen').classList.add('hidden');
}

function showDashboard() {
  currentScreen = 'dashboard';
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('dashboardScreen').classList.remove('hidden');
  
  // Update UI with user data
  if (userData) {
    document.getElementById('userName').textContent = userData.name || 'User';
    document.getElementById('userEmail').textContent = userData.email || '';
    
    if (userData.picture) {
      document.getElementById('userAvatar').src = userData.picture;
    }
  }
  
  // Update tracking status
  updateTrackingStatus();
  
  // Start periodic updates
  if (updateInterval) clearInterval(updateInterval);
  updateInterval = setInterval(updateStats, 2000); // Update every 2 seconds
  
  // Initial stats update
  updateStats();
}

async function handleGoogleSignIn() {
  const btn = document.getElementById('googleSignInBtn');
  const originalText = btn.innerHTML;
  
  try {
    btn.disabled = true;
    btn.innerHTML = '<div class="loading"></div> Signing in...';
    
    const result = await loginWithGoogle();
    
    if (result.success) {
      userData = result.user;
      
      // Store user data
      await setStorageData({
        userId: result.userId,
        accessToken: result.accessToken
      });
      
      showDashboard();
    } else {
      alert('Sign in failed. Please try again.');
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  } catch (error) {
    console.error('Google sign in error:', error);
    alert('Sign in failed. Please try again.');
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function handleEmailSignUp() {
  // Open website signup page
  chrome.tabs.create({ url: 'https://scrollwise.app/signup' });
}

async function handleTrackingToggle() {
  const btn = document.getElementById('trackingToggle');
  const storage = await getStorageData(['userId', 'accessToken']);
  
  if (!storage.userId || !storage.accessToken) {
    alert('Please sign in first');
    return;
  }
  
  try {
    btn.disabled = true;
    
    if (isTracking) {
      // Stop tracking
      await chrome.runtime.sendMessage({ type: 'STOP_TRACKING' });
      isTracking = false;
    } else {
      // Start tracking
      await chrome.runtime.sendMessage({
        type: 'START_TRACKING',
        data: {
          userId: storage.userId,
          accessToken: storage.accessToken
        }
      });
      isTracking = true;
    }
    
    updateTrackingStatus();
    btn.disabled = false;
  } catch (error) {
    console.error('Tracking toggle error:', error);
    btn.disabled = false;
  }
}

function updateTrackingStatus() {
  const statusIndicator = document.getElementById('statusIndicator');
  const trackingStatus = document.getElementById('trackingStatus');
  const trackingSubtext = document.getElementById('trackingSubtext');
  const trackingToggle = document.getElementById('trackingToggle');
  
  if (isTracking) {
    statusIndicator.classList.add('active');
    trackingStatus.textContent = 'Tracking Active';
    trackingSubtext.textContent = 'Collecting your activity data...';
    trackingToggle.textContent = 'Stop Tracking';
    trackingToggle.classList.add('active');
  } else {
    statusIndicator.classList.remove('active');
    trackingStatus.textContent = 'Not Tracking';
    trackingSubtext.textContent = 'Click Start to begin tracking';
    trackingToggle.textContent = 'Start Tracking';
    trackingToggle.classList.remove('active');
  }
}

async function updateStats() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
  
  if (response && response.sessionData) {
    const data = response.sessionData;
    
    // Update stats
    document.getElementById('scrollCount').textContent = formatNumber(data.scrolls || 0);
    document.getElementById('clickCount').textContent = formatNumber(data.clicks || 0);
    document.getElementById('activeTime').textContent = formatTime(data.activeTime || 0);
    document.getElementById('tabSwitches').textContent = formatNumber(data.tabSwitches || 0);
    
    // Update tracking state
    if (response.isTracking !== isTracking) {
      isTracking = response.isTracking;
      updateTrackingStatus();
    }
  }
}

async function handleRefreshInsight() {
  const btn = document.getElementById('refreshInsight');
  const insightText = document.getElementById('insightText');
  
  try {
    btn.disabled = true;
    btn.textContent = '⏳';
    insightText.textContent = 'Generating AI insight...';
    
    const response = await chrome.runtime.sendMessage({ type: 'GET_INSIGHTS' });
    
    if (response && response.insights && response.insights.length > 0) {
      insightText.textContent = response.insights[0];
    } else {
      insightText.textContent = 'Keep tracking to unlock more insights!';
    }
    
    btn.textContent = '🔄';
    btn.disabled = false;
  } catch (error) {
    console.error('Insight refresh error:', error);
    insightText.textContent = 'Failed to load insight. Try again!';
    btn.textContent = '🔄';
    btn.disabled = false;
  }
}

async function handleViewFullDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
}

async function handleSyncNow() {
  const btn = document.getElementById('syncNowBtn');
  const originalText = btn.textContent;
  
  try {
    btn.disabled = true;
    btn.textContent = '⏳ Syncing...';
    
    await chrome.runtime.sendMessage({ type: 'SYNC_NOW' });
    
    btn.textContent = '✅ Synced!';
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Sync error:', error);
    btn.textContent = '❌ Failed';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);
  }
}

async function handleSettings() {
  // Show settings menu
  const confirmed = confirm('Do you want to sign out?');
  
  if (confirmed) {
    await logout();
    userData = null;
    isTracking = false;
    
    if (updateInterval) {
      clearInterval(updateInterval);
    }
    
    showLogin();
  }
}

// Utility functions
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function formatTime(seconds) {
  if (seconds < 60) {
    return seconds + 's';
  } else if (seconds < 3600) {
    return Math.floor(seconds / 60) + 'm';
  } else {
    return Math.floor(seconds / 3600) + 'h';
  }
}
