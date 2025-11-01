// Content Script - Tracks user activity on web pages
(function() {
  'use strict';
  
  let isTracking = false;
  let activityData = {
    scrolls: 0,
    clicks: 0,
    mouseMovements: 0,
    activeTime: 0,
    keystrokes: 0
  };
  
  let lastActivity = Date.now();
  let mouseMoveThrottle;
  let syncInterval;
  let activeTimeInterval;
  
  // Initialize
  init();
  
  function init() {
    console.log('ScrollWise content script loaded on:', window.location.href);
    
    // Check if tracking is enabled
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response && response.isTracking) {
        startTracking();
      }
    });
    
    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'START_TRACKING') {
        startTracking();
        sendResponse({ success: true });
      } else if (message.type === 'STOP_TRACKING') {
        stopTracking();
        sendResponse({ success: true });
      }
    });
  }
  
  function startTracking() {
    if (isTracking) return;
    
    console.log('Starting activity tracking');
    isTracking = true;
    
    // Reset activity data
    activityData = {
      scrolls: 0,
      clicks: 0,
      mouseMovements: 0,
      activeTime: 0,
      keystrokes: 0
    };
    
    // Add event listeners
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('click', handleClick, { passive: true });
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('keydown', handleKeyPress, { passive: true });
    
    // Track active time
    activeTimeInterval = setInterval(trackActiveTime, 1000);
    
    // Sync data periodically
    syncInterval = setInterval(syncData, 10000); // Every 10 seconds
  }
  
  function stopTracking() {
    if (!isTracking) return;
    
    console.log('Stopping activity tracking');
    isTracking = false;
    
    // Remove event listeners
    window.removeEventListener('scroll', handleScroll);
    document.removeEventListener('click', handleClick);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('keydown', handleKeyPress);
    
    // Clear intervals
    clearInterval(activeTimeInterval);
    clearInterval(syncInterval);
    
    // Final sync
    syncData();
  }
  
  function handleScroll() {
    if (!isTracking) return;
    activityData.scrolls++;
    lastActivity = Date.now();
  }
  
  function handleClick(e) {
    if (!isTracking) return;
    activityData.clicks++;
    lastActivity = Date.now();
  }
  
  function handleMouseMove() {
    if (!isTracking) return;
    
    // Throttle mouse move events (max once per 100ms)
    if (mouseMoveThrottle) return;
    
    mouseMoveThrottle = setTimeout(() => {
      activityData.mouseMovements++;
      mouseMoveThrottle = null;
    }, 100);
    
    lastActivity = Date.now();
  }
  
  function handleKeyPress() {
    if (!isTracking) return;
    activityData.keystrokes++;
    lastActivity = Date.now();
  }
  
  function trackActiveTime() {
    if (!isTracking) return;
    
    // Consider user active if there was activity in last 5 seconds
    const timeSinceLastActivity = Date.now() - lastActivity;
    if (timeSinceLastActivity < 5000) {
      activityData.activeTime += 1; // Add 1 second
    }
  }
  
  function syncData() {
    if (!isTracking) return;
    
    // Only sync if there's meaningful activity
    if (activityData.scrolls > 0 || activityData.clicks > 0 || activityData.activeTime > 0) {
      chrome.runtime.sendMessage({
        type: 'ACTIVITY_DATA',
        data: { ...activityData }
      }).catch(err => {
        console.error('Failed to sync data:', err);
      });
      
      // Reset activity data after sync
      activityData = {
        scrolls: 0,
        clicks: 0,
        mouseMovements: 0,
        activeTime: 0,
        keystrokes: 0
      };
    }
  }
  
  // Sync before page unload
  window.addEventListener('beforeunload', () => {
    if (isTracking) {
      syncData();
    }
  });
  
})();
