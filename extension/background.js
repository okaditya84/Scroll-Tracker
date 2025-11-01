// Background Service Worker - Handles tracking coordination
import { saveActivityData, syncWithServer } from './utils/api.js';
import { getStorageData, setStorageData } from './utils/storage.js';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const KEEP_ALIVE_INTERVAL = 20 * 1000; // 20 seconds

// Keep service worker alive
let keepAliveInterval;
let syncInterval;

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('ScrollWise installed:', details.reason);
  
  // Initialize storage
  await initializeStorage();
  
  // Set up alarms for periodic sync
  chrome.alarms.create('syncData', { periodInMinutes: 5 });
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
});

// Keep service worker alive
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('Keep alive ping');
  } else if (alarm.name === 'syncData') {
    syncDataToServer();
  }
});

// Initialize storage with default values
async function initializeStorage() {
  const defaults = {
    isTracking: false,
    userId: null,
    accessToken: null,
    sessionData: {
      scrolls: 0,
      clicks: 0,
      mouseMovements: 0,
      tabSwitches: 0,
      activeTime: 0,
      idleTime: 0,
      sessionStart: null
    },
    dailyStats: {},
    insights: []
  };
  
  const existing = await getStorageData(['isTracking', 'userId']);
  if (!existing.isTracking) {
    await setStorageData(defaults);
  }
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.type) {
    case 'START_TRACKING':
      handleStartTracking(message.data);
      sendResponse({ success: true });
      break;
      
    case 'STOP_TRACKING':
      handleStopTracking();
      sendResponse({ success: true });
      break;
      
    case 'ACTIVITY_DATA':
      handleActivityData(message.data, sender.tab);
      sendResponse({ success: true });
      break;
      
    case 'GET_STATUS':
      getTrackingStatus().then(status => sendResponse(status));
      return true; // Will respond asynchronously
      
    case 'SYNC_NOW':
      syncDataToServer().then(() => sendResponse({ success: true }));
      return true;
      
    case 'GET_INSIGHTS':
      generateInsights().then(insights => sendResponse({ insights }));
      return true;
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
  
  return true; // Keep message channel open for async responses
});

// Handle start tracking
async function handleStartTracking(userData) {
  console.log('Starting tracking for user:', userData.userId);
  
  await setStorageData({
    isTracking: true,
    userId: userData.userId,
    accessToken: userData.accessToken,
    'sessionData.sessionStart': Date.now()
  });
  
  // Notify all content scripts to start tracking
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { type: 'START_TRACKING' }).catch(() => {});
  });
}

// Handle stop tracking
async function handleStopTracking() {
  console.log('Stopping tracking');
  
  // Sync final data before stopping
  await syncDataToServer();
  
  await setStorageData({
    isTracking: false,
    'sessionData.sessionStart': null
  });
  
  // Notify all content scripts to stop tracking
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { type: 'STOP_TRACKING' }).catch(() => {});
  });
}

// Handle incoming activity data from content scripts
async function handleActivityData(data, tab) {
  const storage = await getStorageData(['isTracking', 'sessionData', 'userId']);
  
  if (!storage.isTracking) return;
  
  const sessionData = storage.sessionData || {};
  
  // Update session data
  const updates = {
    'sessionData.scrolls': (sessionData.scrolls || 0) + (data.scrolls || 0),
    'sessionData.clicks': (sessionData.clicks || 0) + (data.clicks || 0),
    'sessionData.mouseMovements': (sessionData.mouseMovements || 0) + (data.mouseMovements || 0),
    'sessionData.activeTime': (sessionData.activeTime || 0) + (data.activeTime || 0)
  };
  
  // Add metadata
  const timestamp = Date.now();
  const activityLog = {
    timestamp,
    tabId: tab?.id,
    url: tab?.url,
    title: tab?.title,
    ...data
  };
  
  // Store activity log
  const logs = await getStorageData(['activityLogs']) || { activityLogs: [] };
  logs.activityLogs.push(activityLog);
  
  // Keep only last 1000 logs in memory
  if (logs.activityLogs.length > 1000) {
    logs.activityLogs = logs.activityLogs.slice(-1000);
  }
  
  await setStorageData({ ...updates, activityLogs: logs.activityLogs });
}

// Get current tracking status
async function getTrackingStatus() {
  const data = await getStorageData(['isTracking', 'userId', 'sessionData']);
  return {
    isTracking: data.isTracking || false,
    userId: data.userId,
    sessionData: data.sessionData || {}
  };
}

// Sync data to server
async function syncDataToServer() {
  const storage = await getStorageData(['userId', 'accessToken', 'sessionData', 'activityLogs', 'isTracking']);
  
  if (!storage.userId || !storage.accessToken || !storage.isTracking) {
    console.log('Not syncing - user not logged in or not tracking');
    return;
  }
  
  try {
    const response = await fetch('https://your-backend.onrender.com/api/activity/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${storage.accessToken}`
      },
      body: JSON.stringify({
        userId: storage.userId,
        sessionData: storage.sessionData,
        activityLogs: storage.activityLogs || [],
        timestamp: Date.now()
      })
    });
    
    if (response.ok) {
      console.log('Data synced successfully');
      // Clear activity logs after successful sync
      await setStorageData({ activityLogs: [] });
    } else {
      console.error('Sync failed:', response.statusText);
    }
  } catch (error) {
    console.error('Sync error:', error);
  }
}

// Generate insights using Groq API
async function generateInsights() {
  const storage = await getStorageData(['userId', 'accessToken', 'sessionData']);
  
  if (!storage.userId || !storage.accessToken) {
    return null;
  }
  
  try {
    const response = await fetch('https://your-backend.onrender.com/api/insights/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${storage.accessToken}`
      },
      body: JSON.stringify({
        userId: storage.userId,
        sessionData: storage.sessionData
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      await setStorageData({ insights: data.insights });
      return data.insights;
    }
  } catch (error) {
    console.error('Error generating insights:', error);
  }
  
  return null;
}

// Monitor tab switches
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const storage = await getStorageData(['isTracking', 'sessionData']);
  
  if (storage.isTracking) {
    const updates = {
      'sessionData.tabSwitches': (storage.sessionData?.tabSwitches || 0) + 1
    };
    await setStorageData(updates);
  }
});

// Monitor when tabs are updated (URL changes)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const storage = await getStorageData(['isTracking']);
    
    if (storage.isTracking) {
      // Inject content script if needed
      chrome.tabs.sendMessage(tabId, { type: 'START_TRACKING' }).catch(() => {
        // Content script not loaded, ignore
      });
    }
  }
});

console.log('ScrollWise background service worker loaded');
