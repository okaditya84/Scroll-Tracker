const express = require('express');
const { authenticateToken } = require('./auth');
const ScrollSession = require('../models/ScrollStat');

const router = express.Router();

// Get analytics for today
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sessions = await ScrollSession.find({
      userId: req.user.id,
      startTime: {
        $gte: today,
        $lt: tomorrow
      }
    });

    const analytics = calculateAnalytics(sessions);
    
    res.json({
      success: true,
      data: {
        ...analytics,
        period: 'today',
        date: today.toISOString()
      }
    });

  } catch (error) {
    console.error('Today analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch today analytics' });
  }
});

// Get analytics for this week
router.get('/week', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const sessions = await ScrollSession.find({
      userId: req.user.id,
      startTime: {
        $gte: weekStart,
        $lt: weekEnd
      }
    });

    const analytics = calculateAnalytics(sessions);
    const dailyBreakdown = calculateDailyBreakdown(sessions, weekStart, 7);
    
    res.json({
      success: true,
      data: {
        ...analytics,
        period: 'week',
        dailyBreakdown,
        weekStart: weekStart.toISOString()
      }
    });

  } catch (error) {
    console.error('Week analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch week analytics' });
  }
});

// Get analytics for this month
router.get('/month', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const sessions = await ScrollSession.find({
      userId: req.user.id,
      startTime: {
        $gte: monthStart,
        $lt: monthEnd
      }
    });

    const analytics = calculateAnalytics(sessions);
    const dailyBreakdown = calculateDailyBreakdown(sessions, monthStart, new Date(monthEnd - 1).getDate());
    
    res.json({
      success: true,
      data: {
        ...analytics,
        period: 'month',
        dailyBreakdown,
        monthStart: monthStart.toISOString()
      }
    });

  } catch (error) {
    console.error('Month analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch month analytics' });
  }
});

// Get user profile with stats
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all-time stats
    const allSessions = await ScrollSession.find({ userId: req.user.id });
    const allTimeStats = calculateAnalytics(allSessions);
    
    // Calculate streaks and achievements
    const achievements = calculateAchievements(allSessions);
    
    res.json({
      success: true,
      user: {
        ...user.toSafeObject(),
        stats: {
          ...allTimeStats,
          totalSessions: allSessions.length,
          achievements
        }
      }
    });

  } catch (error) {
    console.error('Profile analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch profile analytics' });
  }
});

// Get custom date range analytics
router.get('/range', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const sessions = await ScrollSession.find({
      userId: req.user.id,
      startTime: {
        $gte: start,
        $lt: end
      }
    });

    const analytics = calculateAnalytics(sessions);
    
    res.json({
      success: true,
      data: {
        ...analytics,
        period: 'custom',
        startDate: start.toISOString(),
        endDate: end.toISOString()
      }
    });

  } catch (error) {
    console.error('Range analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch range analytics' });
  }
});

// Helper function to calculate analytics from sessions
function calculateAnalytics(sessions) {
  if (sessions.length === 0) {
    return {
      totalScrollDistance: 0,
      totalScrollTime: 0,
      averageSpeed: 0,
      totalTime: 0,
      totalEvents: 0,
      sessionCount: 0,
      averageSessionDuration: 0,
      mostActiveHour: null,
      topWebsites: []
    };
  }

  const totalScrollDistance = sessions.reduce((sum, s) => sum + (s.totalScrollDistance || 0), 0);
  const totalScrollTime = sessions.reduce((sum, s) => sum + (s.totalScrollTime || 0), 0);
  const totalTime = sessions.reduce((sum, s) => sum + (s.lastUpdated - s.startTime), 0);
  const totalEvents = sessions.reduce((sum, s) => sum + (s.scrollEvents || 0), 0);
  
  const averageSpeed = totalScrollTime > 0 ? totalScrollDistance / (totalScrollTime / 1000) : 0;
  const averageSessionDuration = sessions.length > 0 ? totalTime / sessions.length : 0;

  // Calculate most active hour
  const hourCounts = {};
  sessions.forEach(session => {
    const hour = new Date(session.startTime).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  const mostActiveHour = Object.entries(hourCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || null;

  // Calculate top websites
  const websiteCounts = {};
  sessions.forEach(session => {
    if (session.website) {
      websiteCounts[session.website] = (websiteCounts[session.website] || 0) + (session.totalScrollDistance || 0);
    }
  });
  
  const topWebsites = Object.entries(websiteCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([website, scrollDistance]) => ({ website, scrollDistance }));

  return {
    totalScrollDistance,
    totalScrollTime,
    averageSpeed,
    totalTime,
    totalEvents,
    sessionCount: sessions.length,
    averageSessionDuration,
    mostActiveHour: mostActiveHour ? parseInt(mostActiveHour) : null,
    topWebsites
  };
}

// Helper function to calculate daily breakdown
function calculateDailyBreakdown(sessions, startDate, days) {
  const breakdown = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);
    
    const daySessions = sessions.filter(session => 
      session.startTime >= date && session.startTime < nextDate
    );
    
    const dayAnalytics = calculateAnalytics(daySessions);
    
    breakdown.push({
      date: date.toISOString().split('T')[0],
      ...dayAnalytics
    });
  }
  
  return breakdown;
}

// Helper function to calculate achievements
function calculateAchievements(sessions) {
  const achievements = [];
  
  const totalDistance = sessions.reduce((sum, s) => sum + (s.totalScrollDistance || 0), 0);
  const totalSessions = sessions.length;
  
  // Distance achievements
  if (totalDistance >= 1000000) achievements.push({ type: 'distance', level: 'gold', title: 'Scroll Master', description: '1M+ pixels scrolled' });
  else if (totalDistance >= 500000) achievements.push({ type: 'distance', level: 'silver', title: 'Scroll Expert', description: '500K+ pixels scrolled' });
  else if (totalDistance >= 100000) achievements.push({ type: 'distance', level: 'bronze', title: 'Scroll Explorer', description: '100K+ pixels scrolled' });
  
  // Session achievements
  if (totalSessions >= 1000) achievements.push({ type: 'sessions', level: 'gold', title: 'Session Champion', description: '1000+ sessions' });
  else if (totalSessions >= 500) achievements.push({ type: 'sessions', level: 'silver', title: 'Session Pro', description: '500+ sessions' });
  else if (totalSessions >= 100) achievements.push({ type: 'sessions', level: 'bronze', title: 'Session Starter', description: '100+ sessions' });
  
  // Calculate streak (consecutive days with activity)
  const dates = [...new Set(sessions.map(s => new Date(s.startTime).toDateString()))].sort();
  let currentStreak = 0;
  let maxStreak = 0;
  
  for (let i = dates.length - 1; i >= 0; i--) {
    const date = new Date(dates[i]);
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - (dates.length - 1 - i));
    
    if (date.toDateString() === expectedDate.toDateString()) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      break;
    }
  }
  
  if (maxStreak >= 30) achievements.push({ type: 'streak', level: 'gold', title: 'Consistency Master', description: '30+ day streak' });
  else if (maxStreak >= 14) achievements.push({ type: 'streak', level: 'silver', title: 'Consistency Pro', description: '14+ day streak' });
  else if (maxStreak >= 7) achievements.push({ type: 'streak', level: 'bronze', title: 'Week Warrior', description: '7+ day streak' });
  
  return {
    achievements,
    currentStreak,
    maxStreak
  };
}

module.exports = router;
