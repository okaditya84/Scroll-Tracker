const express = require('express');
const User = require('../models/User');
const ScrollSession = require('../models/ScrollStat');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get user dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get recent sessions
    const recentSessions = await ScrollSession.getSessionsByUser(userId, 10);
    
    // Get stats for last 30 days
    const monthlyStats = await ScrollSession.getSessionStats(userId, {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    });

    // Get daily stats for chart
    const dailyStats = await ScrollSession.getDailyStats(userId, 30);

    res.json({
      success: true,
      dashboard: {
        user: user.toSafeObject(),
        recentSessions: recentSessions.map(session => session.getMetrics()),
        monthlyStats: monthlyStats[0] || {},
        dailyStats,
        achievements: user.achievements,
        streak: user.stats.streak
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get user achievements
router.get('/achievements', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for new achievements
    const newAchievements = user.checkAchievements();
    if (newAchievements.length > 0) {
      await user.save();
    }

    res.json({
      success: true,
      achievements: user.achievements,
      newAchievements,
      totalAchievements: user.achievements.length
    });

  } catch (error) {
    console.error('Achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Update user settings
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const newSettings = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Merge settings
    user.settings = { ...user.settings, ...newSettings };
    await user.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: user.settings
    });

  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get user leaderboard position
router.get('/leaderboard-position', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type = 'distance' } = req.query;

    const sortField = type === 'distance' 
      ? 'stats.totalScrollDistance' 
      : type === 'time' 
      ? 'stats.totalScrollTime'
      : 'stats.totalSessions';

    const userPosition = await User.aggregate([
      { $match: { isActive: true } },
      { $sort: { [sortField]: -1 } },
      { $group: {
          _id: null,
          users: { $push: { _id: '$_id', [sortField]: `$${sortField}` } }
        }
      },
      { $unwind: { path: '$users', includeArrayIndex: 'position' } },
      { $match: { 'users._id': userId } },
      { $project: { position: { $add: ['$position', 1] }, value: `$users.${sortField}` } }
    ]);

    const position = userPosition[0] || { position: null, value: 0 };
    const totalUsers = await User.countDocuments({ isActive: true });

    res.json({
      success: true,
      leaderboard: {
        position: position.position,
        totalUsers,
        value: position.value,
        type,
        percentile: position.position ? Math.round((1 - position.position / totalUsers) * 100) : 0
      }
    });

  } catch (error) {
    console.error('Leaderboard position error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard position' });
  }
});

// Get user's scroll heatmap data
router.get('/heatmap', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 365 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const heatmapData = await ScrollSession.aggregate([
      {
        $match: {
          userId: userId,
          startTime: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$startTime' },
            month: { $month: '$startTime' },
            day: { $dayOfMonth: '$startTime' }
          },
          date: { $first: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } } },
          totalDistance: { $sum: '$totalScrollDistance' },
          totalTime: { $sum: '$totalScrollTime' },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.json({
      success: true,
      heatmap: heatmapData,
      dateRange: {
        start: startDate,
        end: new Date(),
        days
      }
    });

  } catch (error) {
    console.error('Heatmap error:', error);
    res.status(500).json({ error: 'Failed to generate heatmap data' });
  }
});

// Get user's scroll patterns analysis
router.get('/patterns', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const patterns = await ScrollSession.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          avgSessionDuration: { $avg: '$sessionDuration' },
          avgScrollSpeed: { $avg: '$averageScrollSpeed' },
          avgScrollDistance: { $avg: '$totalScrollDistance' },
          avgScrollTime: { $avg: '$totalScrollTime' },
          totalSessions: { $sum: 1 },
          // Hour of day analysis
          hourlyActivity: {
            $push: { $hour: '$startTime' }
          },
          // Day of week analysis
          weeklyActivity: {
            $push: { $dayOfWeek: '$startTime' }
          }
        }
      }
    ]);

    const pattern = patterns[0] || {};

    // Analyze peak hours
    const hourCounts = {};
    (pattern.hourlyActivity || []).forEach(hour => {
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const peakHour = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];

    // Analyze peak days
    const dayCounts = {};
    (pattern.weeklyActivity || []).forEach(day => {
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    const peakDay = Object.entries(dayCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];

    const dayNames = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    res.json({
      success: true,
      patterns: {
        ...pattern,
        peakHour: peakHour ? `${peakHour}:00` : null,
        peakDay: peakDay ? dayNames[peakDay] : null,
        hourlyDistribution: hourCounts,
        weeklyDistribution: dayCounts
      }
    });

  } catch (error) {
    console.error('Patterns analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze patterns' });
  }
});

// Get user's milestone progress
router.get('/milestones', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const milestones = [
      {
        name: 'First Scroll',
        description: 'Complete your first scroll session',
        target: 1,
        current: user.stats.totalSessions,
        type: 'sessions',
        completed: user.stats.totalSessions >= 1,
        icon: '🎯'
      },
      {
        name: 'Distance Explorer',
        description: 'Scroll 10,000 pixels',
        target: 10000,
        current: user.stats.totalScrollDistance,
        type: 'distance',
        completed: user.stats.totalScrollDistance >= 10000,
        icon: '🗺️'
      },
      {
        name: 'Time Traveler',
        description: 'Spend 1 hour scrolling',
        target: 3600000, // milliseconds
        current: user.stats.totalScrollTime,
        type: 'time',
        completed: user.stats.totalScrollTime >= 3600000,
        icon: '⏰'
      },
      {
        name: 'Marathon Scroller',
        description: 'Scroll 1 million pixels',
        target: 1000000,
        current: user.stats.totalScrollDistance,
        type: 'distance',
        completed: user.stats.totalScrollDistance >= 1000000,
        icon: '🏔️'
      },
      {
        name: 'Streak Master',
        description: 'Maintain a 7-day streak',
        target: 7,
        current: user.stats.streak.longest,
        type: 'streak',
        completed: user.stats.streak.longest >= 7,
        icon: '🔥'
      }
    ];

    // Calculate progress percentages
    milestones.forEach(milestone => {
      milestone.progress = Math.min((milestone.current / milestone.target) * 100, 100);
    });

    res.json({
      success: true,
      milestones,
      completedCount: milestones.filter(m => m.completed).length,
      totalCount: milestones.length
    });

  } catch (error) {
    console.error('Milestones error:', error);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

module.exports = router;
