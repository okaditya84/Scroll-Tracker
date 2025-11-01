import express from 'express';
import User from '../models/User.js';
import Activity from '../models/Activity.js';
import DailyStats from '../models/DailyStats.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get user statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Get all-time stats
    const allActivities = await Activity.find({ userId: req.userId });
    
    const allTimeStats = allActivities.reduce((acc, activity) => {
      acc.scrolls += activity.sessionData.scrolls || 0;
      acc.clicks += activity.sessionData.clicks || 0;
      acc.activeTime += activity.sessionData.activeTime || 0;
      acc.tabSwitches += activity.sessionData.tabSwitches || 0;
      return acc;
    }, {
      scrolls: 0,
      clicks: 0,
      activeTime: 0,
      tabSwitches: 0
    });
    
    // Get current streak
    const streak = await calculateStreak(req.userId);
    
    // Get rankings (percentile)
    const rankings = await calculateRankings(req.userId, allTimeStats);
    
    res.json({
      success: true,
      data: {
        allTimeStats,
        streak,
        rankings,
        totalDaysTracked: allActivities.length
      }
    });
    
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// Delete user account
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'DELETE') {
      return res.status(400).json({ error: 'Confirmation required' });
    }
    
    // Delete all user data
    await Promise.all([
      User.findByIdAndDelete(req.userId),
      Activity.deleteMany({ userId: req.userId }),
      DailyStats.deleteMany({ userId: req.userId })
    ]);
    
    res.json({
      success: true,
      message: 'Account and all data deleted successfully'
    });
    
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Helper function to calculate streak
async function calculateStreak(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let currentStreak = 0;
  let checkDate = new Date(today);
  
  while (true) {
    const activity = await Activity.findOne({
      userId,
      date: checkDate
    });
    
    if (!activity || activity.sessionData.activeTime < 60) {
      break;
    }
    
    currentStreak++;
    checkDate.setDate(checkDate.getDate() - 1);
    
    // Limit check to 365 days
    if (currentStreak >= 365) break;
  }
  
  return currentStreak;
}

// Helper function to calculate rankings
async function calculateRankings(userId, userStats) {
  try {
    // Get all users' total stats (simplified - in production, use aggregation)
    const allUsers = await Activity.aggregate([
      {
        $group: {
          _id: '$userId',
          totalScrolls: { $sum: '$sessionData.scrolls' },
          totalClicks: { $sum: '$sessionData.clicks' },
          totalActiveTime: { $sum: '$sessionData.activeTime' }
        }
      }
    ]);
    
    const totalUsers = allUsers.length;
    
    if (totalUsers === 0) {
      return { scrolls: 100, clicks: 100, activeTime: 100 };
    }
    
    const scrollRank = allUsers.filter(u => u.totalScrolls < userStats.scrolls).length;
    const clickRank = allUsers.filter(u => u.totalClicks < userStats.clicks).length;
    const timeRank = allUsers.filter(u => u.totalActiveTime < userStats.activeTime).length;
    
    return {
      scrolls: Math.round((scrollRank / totalUsers) * 100),
      clicks: Math.round((clickRank / totalUsers) * 100),
      activeTime: Math.round((timeRank / totalUsers) * 100)
    };
  } catch (error) {
    console.error('Rankings calculation error:', error);
    return { scrolls: 50, clicks: 50, activeTime: 50 };
  }
}

export default router;
