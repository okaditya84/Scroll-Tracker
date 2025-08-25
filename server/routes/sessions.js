const express = require('express');
const ScrollSession = require('../models/ScrollStat');
const User = require('../models/User');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Middleware to handle optional authentication
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
};

// Create or update scroll session
router.post('/', optionalAuth, async (req, res) => {
  try {
    const sessionData = req.body;
    const userId = req.user?.id;

    // Validate required fields
    if (!sessionData.sessionId) {
      return res.status(400).json({ 
        error: 'Session ID is required' 
      });
    }

    // Find existing session or create new one
    let session = await ScrollSession.findOne({ 
      sessionId: sessionData.sessionId 
    });

    if (session) {
      // Update existing session
      Object.assign(session, {
        ...sessionData,
        userId: userId || session.userId,
        lastUpdated: new Date()
      });
    } else {
      // Create new session
      session = new ScrollSession({
        ...sessionData,
        userId: userId || null,
        startTime: sessionData.startTime || new Date(),
        lastUpdated: new Date()
      });
    }

    await session.save();

    // Update user stats if authenticated
    if (userId) {
      try {
        const user = await User.findById(userId);
        if (user) {
          await user.updateStats(sessionData);
          
          // Check for new achievements
          const newAchievements = user.checkAchievements();
          if (newAchievements.length > 0) {
            await user.save();
          }
        }
      } catch (userError) {
        console.error('User stats update error:', userError);
        // Don't fail the session save if user update fails
      }
    }

    res.json({
      success: true,
      message: 'Session saved successfully',
      session: session.getMetrics()
    });

  } catch (error) {
    console.error('Session save error:', error);
    res.status(500).json({ 
      error: 'Failed to save session' 
    });
  }
});

// Get user's sessions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, page = 1, dateFrom, dateTo } = req.query;
    const userId = req.user.id;

    const query = { userId };
    
    // Add date range filter if provided
    if (dateFrom || dateTo) {
      query.startTime = {};
      if (dateFrom) query.startTime.$gte = new Date(dateFrom);
      if (dateTo) query.startTime.$lte = new Date(dateTo);
    }

    const sessions = await ScrollSession.find(query)
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .exec();

    const total = await ScrollSession.countDocuments(query);

    res.json({
      success: true,
      sessions: sessions.map(session => session.getMetrics()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Sessions fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch sessions' 
    });
  }
});

// Get session by ID
router.get('/:sessionId', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    const query = { sessionId };
    
    // If authenticated, only return user's sessions
    if (userId) {
      query.userId = userId;
    }

    const session = await ScrollSession.findOne(query);

    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    res.json({
      success: true,
      session: session.getMetrics()
    });

  } catch (error) {
    console.error('Session fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch session' 
    });
  }
});

// Delete session
router.delete('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await ScrollSession.findOneAndDelete({ 
      sessionId, 
      userId 
    });

    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('Session delete error:', error);
    res.status(500).json({ 
      error: 'Failed to delete session' 
    });
  }
});

// Get user statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;

    const dateRange = {
      start: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      end: new Date()
    };

    const [sessionStats, dailyStats] = await Promise.all([
      ScrollSession.getSessionStats(userId, dateRange),
      ScrollSession.getDailyStats(userId, days)
    ]);

    const stats = sessionStats[0] || {
      totalSessions: 0,
      totalScrollDistance: 0,
      totalScrollTime: 0,
      totalSessionTime: 0,
      averageScrollSpeed: 0,
      totalScrollEvents: 0
    };

    res.json({
      success: true,
      stats,
      dailyStats,
      dateRange
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics' 
    });
  }
});

// Get leaderboard data
router.get('/stats/leaderboard', async (req, res) => {
  try {
    const { type = 'distance', limit = 10 } = req.query;
    
    const leaderboard = await User.getLeaderboard(parseInt(limit), type);
    
    res.json({
      success: true,
      leaderboard: leaderboard.map(user => ({
        username: user.username,
        stats: user.stats,
        achievements: user.achievements.length
      })),
      type
    });

  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch leaderboard' 
    });
  }
});

// Export multiple sessions for backup
router.get('/export/json', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessions = await ScrollSession.find({ userId }).sort({ startTime: -1 });
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=scroll-sessions.json');
    
    res.json({
      exportDate: new Date().toISOString(),
      userId,
      totalSessions: sessions.length,
      sessions: sessions.map(session => session.toObject())
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      error: 'Failed to export sessions' 
    });
  }
});

// Bulk import sessions
router.post('/import', authenticateToken, async (req, res) => {
  try {
    const { sessions } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(sessions)) {
      return res.status(400).json({ 
        error: 'Sessions must be an array' 
      });
    }

    const importResults = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    for (const sessionData of sessions) {
      try {
        // Check if session already exists
        const existing = await ScrollSession.findOne({ 
          sessionId: sessionData.sessionId 
        });

        if (existing) {
          importResults.skipped++;
          continue;
        }

        // Create new session
        const session = new ScrollSession({
          ...sessionData,
          userId
        });

        await session.save();
        importResults.imported++;

      } catch (sessionError) {
        importResults.errors.push({
          sessionId: sessionData.sessionId,
          error: sessionError.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Import completed',
      results: importResults
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: 'Failed to import sessions' 
    });
  }
});

module.exports = router;
