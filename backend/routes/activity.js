import express from 'express';
import Activity from '../models/Activity.js';
import DailyStats from '../models/DailyStats.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Sync activity data from extension
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const { sessionData, activityLogs, timestamp } = req.body;
    
    // Get today's date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Create or update activity record
    const activity = await Activity.findOneAndUpdate(
      {
        userId: req.userId,
        date: today
      },
      {
        $inc: {
          'sessionData.scrolls': sessionData.scrolls || 0,
          'sessionData.clicks': sessionData.clicks || 0,
          'sessionData.mouseMovements': sessionData.mouseMovements || 0,
          'sessionData.keystrokes': sessionData.keystrokes || 0,
          'sessionData.tabSwitches': sessionData.tabSwitches || 0,
          'sessionData.activeTime': sessionData.activeTime || 0,
          'sessionData.idleTime': sessionData.idleTime || 0
        },
        $push: {
          activityLogs: {
            $each: activityLogs || []
          }
        }
      },
      {
        upsert: true,
        new: true
      }
    );
    
    // Update daily stats
    await updateDailyStats(req.userId, today, sessionData, activityLogs);
    
    res.json({
      success: true,
      message: 'Activity synced successfully',
      activity
    });
    
  } catch (error) {
    console.error('Activity sync error:', error);
    res.status(500).json({ error: 'Failed to sync activity' });
  }
});

// Get user activity summary
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);
    
    const activities = await Activity.find({
      userId: req.userId,
      date: { $gte: startDate }
    })
    .sort({ date: -1 })
    .limit(parseInt(days));
    
    // Calculate totals
    const totals = activities.reduce((acc, activity) => {
      acc.scrolls += activity.sessionData.scrolls || 0;
      acc.clicks += activity.sessionData.clicks || 0;
      acc.mouseMovements += activity.sessionData.mouseMovements || 0;
      acc.activeTime += activity.sessionData.activeTime || 0;
      acc.tabSwitches += activity.sessionData.tabSwitches || 0;
      return acc;
    }, {
      scrolls: 0,
      clicks: 0,
      mouseMovements: 0,
      activeTime: 0,
      tabSwitches: 0
    });
    
    res.json({
      success: true,
      data: {
        activities,
        totals,
        period: {
          start: startDate,
          end: new Date(),
          days: parseInt(days)
        }
      }
    });
    
  } catch (error) {
    console.error('Activity summary error:', error);
    res.status(500).json({ error: 'Failed to fetch activity summary' });
  }
});

// Get daily stats
router.get('/daily/:date?', authenticateToken, async (req, res) => {
  try {
    const date = req.params.date ? new Date(req.params.date) : new Date();
    date.setHours(0, 0, 0, 0);
    
    const stats = await DailyStats.findOne({
      userId: req.userId,
      date
    });
    
    if (!stats) {
      return res.json({
        success: true,
        data: null,
        message: 'No data for this date'
      });
    }
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Daily stats error:', error);
    res.status(500).json({ error: 'Failed to fetch daily stats' });
  }
});

// Get activity trends
router.get('/trends', authenticateToken, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    let days = 7;
    if (period === '30d') days = 30;
    else if (period === '90d') days = 90;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const dailyStats = await DailyStats.find({
      userId: req.userId,
      date: { $gte: startDate }
    })
    .sort({ date: 1 })
    .select('date stats');
    
    // Calculate trends
    const trends = calculateTrends(dailyStats);
    
    res.json({
      success: true,
      data: {
        dailyStats,
        trends
      }
    });
    
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// Helper function to update daily stats
async function updateDailyStats(userId, date, sessionData, activityLogs) {
  try {
    // Extract website data from activity logs
    const websiteData = {};
    
    if (activityLogs && activityLogs.length > 0) {
      activityLogs.forEach(log => {
        if (log.url) {
          try {
            const domain = new URL(log.url).hostname;
            
            if (!websiteData[domain]) {
              websiteData[domain] = {
                url: log.url,
                domain,
                visits: 0,
                timeSpent: 0,
                scrolls: 0,
                clicks: 0
              };
            }
            
            websiteData[domain].visits += 1;
            websiteData[domain].timeSpent += log.activeTime || 0;
            websiteData[domain].scrolls += log.scrolls || 0;
            websiteData[domain].clicks += log.clicks || 0;
          } catch (e) {
            // Invalid URL, skip
          }
        }
      });
    }
    
    const topWebsites = Object.values(websiteData)
      .sort((a, b) => b.timeSpent - a.timeSpent)
      .slice(0, 10);
    
    await DailyStats.findOneAndUpdate(
      { userId, date },
      {
        $inc: {
          'stats.totalScrolls': sessionData.scrolls || 0,
          'stats.totalClicks': sessionData.clicks || 0,
          'stats.totalMouseMovements': sessionData.mouseMovements || 0,
          'stats.totalKeystrokes': sessionData.keystrokes || 0,
          'stats.totalTabSwitches': sessionData.tabSwitches || 0,
          'stats.totalActiveTime': sessionData.activeTime || 0,
          'stats.totalIdleTime': sessionData.idleTime || 0
        },
        $set: {
          topWebsites
        }
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Update daily stats error:', error);
  }
}

// Helper function to calculate trends
function calculateTrends(dailyStats) {
  if (dailyStats.length < 2) {
    return {
      scrolls: 0,
      clicks: 0,
      activeTime: 0
    };
  }
  
  const recent = dailyStats.slice(-3);
  const previous = dailyStats.slice(-6, -3);
  
  const recentAvg = {
    scrolls: recent.reduce((sum, d) => sum + d.stats.totalScrolls, 0) / recent.length,
    clicks: recent.reduce((sum, d) => sum + d.stats.totalClicks, 0) / recent.length,
    activeTime: recent.reduce((sum, d) => sum + d.stats.totalActiveTime, 0) / recent.length
  };
  
  const previousAvg = {
    scrolls: previous.reduce((sum, d) => sum + d.stats.totalScrolls, 0) / previous.length,
    clicks: previous.reduce((sum, d) => sum + d.stats.totalClicks, 0) / previous.length,
    activeTime: previous.reduce((sum, d) => sum + d.stats.totalActiveTime, 0) / previous.length
  };
  
  return {
    scrolls: previousAvg.scrolls ? ((recentAvg.scrolls - previousAvg.scrolls) / previousAvg.scrolls * 100).toFixed(1) : 0,
    clicks: previousAvg.clicks ? ((recentAvg.clicks - previousAvg.clicks) / previousAvg.clicks * 100).toFixed(1) : 0,
    activeTime: previousAvg.activeTime ? ((recentAvg.activeTime - previousAvg.activeTime) / previousAvg.activeTime * 100).toFixed(1) : 0
  };
}

export default router;
