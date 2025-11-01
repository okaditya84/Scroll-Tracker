import express from 'express';
import Groq from 'groq-sdk';
import Activity from '../models/Activity.js';
import DailyStats from '../models/DailyStats.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Generate AI insights
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { sessionData } = req.body;
    
    // Get user's recent activity
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const recentActivity = await Activity.find({
      userId: req.userId,
      date: { $gte: startDate }
    }).sort({ date: -1 }).limit(7);
    
    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayStats = await DailyStats.findOne({
      userId: req.userId,
      date: today
    });
    
    // Generate insights using Groq
    const insights = await generateInsightsWithGroq(sessionData, recentActivity, todayStats);
    
    // Save insights to database
    if (todayStats) {
      todayStats.insights = insights.map(text => ({
        text,
        category: categorizeInsight(text),
        priority: 'medium'
      }));
      await todayStats.save();
    }
    
    res.json({
      success: true,
      insights
    });
    
  } catch (error) {
    console.error('Insights generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate insights',
      message: error.message 
    });
  }
});

// Get saved insights
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const stats = await DailyStats.find({
      userId: req.userId,
      date: { $gte: startDate },
      'insights.0': { $exists: true }
    })
    .sort({ date: -1 })
    .select('date insights');
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Insights history error:', error);
    res.status(500).json({ error: 'Failed to fetch insights history' });
  }
});

// Helper function to generate insights using Groq
async function generateInsightsWithGroq(sessionData, recentActivity, todayStats) {
  try {
    const totalScrolls = sessionData?.scrolls || 0;
    const totalClicks = sessionData?.clicks || 0;
    const totalActiveTime = sessionData?.activeTime || 0;
    const totalTabSwitches = sessionData?.tabSwitches || 0;
    
    // Calculate fun metrics
    const caloriesBurned = (totalClicks * 0.01 + totalScrolls * 0.005).toFixed(2);
    const distanceScrolled = (totalScrolls * 0.1).toFixed(1); // in meters
    const heatGenerated = (totalClicks * 0.0001).toFixed(4); // joules
    
    // Build context for AI
    const prompt = `You are a witty, engaging AI assistant for ScrollWise, a browser activity tracker. Generate 3 fun, creative, and motivating insights based on the user's browsing activity.

User's Activity Today:
- Scrolls: ${totalScrolls}
- Clicks: ${totalClicks}
- Active Time: ${Math.floor(totalActiveTime / 60)} minutes
- Tab Switches: ${totalTabSwitches}

Fun Metrics:
- Calories Burned: ${caloriesBurned} cal
- Distance Scrolled: ${distanceScrolled} meters
- Heat Generated from clicks: ${heatGenerated} joules

Rules for insights:
1. Make them FUN, CREATIVE, and slightly HUMOROUS
2. Use real-world comparisons (e.g., "That's like scrolling the height of 3 Eiffel Towers!")
3. Mix motivational with playful observations
4. Keep each insight to 1-2 sentences
5. Use emojis sparingly but effectively
6. Vary the types: one about scrolling, one about clicking, one about time/productivity

Examples of good insights:
- "You've scrolled ${distanceScrolled}m today - that's like climbing ${(distanceScrolled / 0.3).toFixed(0)} stairs! 🏔️ Your thumb deserves a medal."
- "With ${totalClicks} clicks, you've generated enough heat to keep a small LED bulb glowing for ${(parseFloat(heatGenerated) * 1000).toFixed(1)} seconds! ⚡"
- "You doom-scrolled for ${Math.floor(totalActiveTime / 60)} minutes, which is enough time to learn 20 new words in a foreign language! 📚"

Generate 3 unique insights now (return ONLY the insights, one per line, no numbering):`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'llama-3.1-70b-versatile',
      temperature: 0.8,
      max_tokens: 500
    });
    
    const insightsText = completion.choices[0]?.message?.content || '';
    const insights = insightsText
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .slice(0, 3);
    
    // Fallback insights if AI fails
    if (insights.length === 0) {
      return [
        `You've scrolled ${distanceScrolled}m today - that's like climbing ${(distanceScrolled / 0.3).toFixed(0)} stairs! 🏔️`,
        `${totalClicks} clicks generated enough heat to warm a cup of coffee by ${(parseFloat(heatGenerated) * 1000).toFixed(2)}°C! ☕`,
        `You spent ${Math.floor(totalActiveTime / 60)} minutes browsing - time for a quick stretch break! 🧘`
      ];
    }
    
    return insights;
    
  } catch (error) {
    console.error('Groq API error:', error);
    
    // Fallback to static insights
    const totalScrolls = sessionData?.scrolls || 0;
    const totalClicks = sessionData?.clicks || 0;
    const totalActiveTime = sessionData?.activeTime || 0;
    
    return [
      `You've scrolled ${totalScrolls} times today! That's like reading ${Math.floor(totalScrolls / 10)} pages of content. 📖`,
      `${totalClicks} clicks - you're more active than a drummer in a rock concert! 🥁`,
      `${Math.floor(totalActiveTime / 60)} minutes of browsing. Remember to take breaks and look away from the screen! 👀`
    ];
  }
}

// Helper function to categorize insight
function categorizeInsight(insightText) {
  const text = insightText.toLowerCase();
  
  if (text.includes('calorie') || text.includes('exercise') || text.includes('health')) {
    return 'health';
  } else if (text.includes('productivity') || text.includes('focus') || text.includes('work')) {
    return 'productivity';
  } else if (text.includes('like') || text.includes('equivalent') || text.includes('compare')) {
    return 'comparison';
  } else {
    return 'fun';
  }
}

export default router;
