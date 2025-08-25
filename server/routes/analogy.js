const express = require('express');
const AnalogyAgent = require('../agents/AnalogyAgent');

// Fallback analogy generation when AI services fail
function generateFallbackAnalogy(metrics) {
  const distance = (metrics.totalScrollDistance || 0) * 0.000264583;
  const time = (metrics.totalScrollTime || 0) / 1000;
  
  return {
    analogies: [
      {
        type: 'distance',
        icon: '🏃‍♂️',
        comparison: distance > 1000 
          ? `You scrolled ${(distance/1000).toFixed(2)} kilometers - that's like jogging through your neighborhood!`
          : `You scrolled ${distance.toFixed(1)} meters - like walking across a basketball court!`
      },
      {
        type: 'energy',
        icon: '⚡',
        comparison: time > 300 
          ? `You spent ${(time/60).toFixed(1)} minutes scrolling - enough time for a power nap!`
          : `${time.toFixed(0)} seconds of scrolling - a quick digital sprint!`
      },
      {
        type: 'fun',
        icon: '🎯',
        comparison: `Your finger traveled the length of ${Math.floor(distance / 0.15)} M&M candies lined up!`
      }
    ],
    funFact: "The average person scrolls through 300 feet of content per day - that's like unrolling a football field!",
    energy: `Your scrolling burned approximately ${(distance * 0.1).toFixed(3)} calories - about the same as blinking 50 times!`
  };
}

const router = express.Router();

// Generate analogy for scroll metrics
router.post('/', async (req, res) => {
  try {
    const metrics = req.body;
    
    console.log('📊 Received analogy request with metrics:', {
      totalScrollDistance: metrics.totalScrollDistance,
      totalScrollTime: metrics.totalScrollTime,
      scrollEvents: metrics.scrollEvents,
      sessionDuration: metrics.sessionDuration
    });
    
    // Validate input
    if (!metrics || typeof metrics !== 'object') {
      return res.status(400).json({
        error: 'Invalid metrics data'
      });
    }

    // Initialize analogy agent
    const analogyAgent = new AnalogyAgent();

    // Generate analogy using only LLM knowledge
    let analogyResult;
    try {
      analogyResult = await analogyAgent.generateAnalogy(metrics);
      console.log('✅ Analogy generation successful');
    } catch (analogyError) {
      console.log('⚠️ Analogy generation failed, using fallback:', analogyError.message);
      analogyResult = generateFallbackAnalogy(metrics);
    }

    // Return analogy with metadata
    const enrichedAnalogy = {
      ...analogyResult,
      metadata: {
        ...analogyResult.metadata,
        timestamp: new Date().toISOString(),
        requestMetrics: {
          distanceInMeters: (metrics.totalScrollDistance || 0) * 0.000264583,
          timeInSeconds: (metrics.totalScrollTime || 0) / 1000
        }
      }
    };

    console.log('📤 Sending analogy response with', 
      enrichedAnalogy.analogies ? enrichedAnalogy.analogies.length : 0, 'analogies');

    res.json({
      success: true,
      analogy: enrichedAnalogy
    });

  } catch (error) {
    console.error('❌ Analogy generation error:', error);
    res.status(500).json({
      error: 'Failed to generate analogy',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Test route for debugging analogy generation
router.post('/test', async (req, res) => {
  try {
    console.log('🧪 Test analogy generation endpoint called');
    
    // Use sample test data
    const testMetrics = {
      totalScrollDistance: 1500, // 1500 pixels
      totalScrollTime: 3000,     // 3 seconds
      scrollEvents: 5,
      sessionDuration: 10000,    // 10 seconds
      averageScrollSpeed: 500    // 500 px/s
    };

    console.log('📊 Using test metrics:', testMetrics);

    const analogyAgent = new AnalogyAgent();
    
    console.log('🔄 Generating test analogy...');
    const result = await analogyAgent.generateAnalogy(testMetrics);
    
    console.log('✅ Test analogy generated successfully');
    
    res.json({
      success: true,
      analogy: result,
      testMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Test analogy generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Generate multiple analogies with different themes
router.post('/themed', async (req, res) => {
  try {
    const { metrics, themes = ['creative', 'scientific', 'humorous'] } = req.body;
    
    if (!metrics) {
      return res.status(400).json({
        error: 'Metrics data is required'
      });
    }

    const analogyAgent = new AnalogyAgent();
    const results = {};

    // Generate different themed analogies
    for (const theme of themes) {
      try {
        // Generate analogy with LLM knowledge only
        const themeResult = await analogyAgent.generateAnalogy(metrics);
        results[theme] = themeResult;
      } catch (themeError) {
        console.error(`Theme ${theme} error:`, themeError);
        results[theme] = { error: 'Generation failed for this theme' };
      }
    }

    res.json({
      success: true,
      analogies: results,
      metadata: {
        themes,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Themed analogy error:', error);
    res.status(500).json({
      error: 'Failed to generate themed analogies'
    });
  }
});

// Generate physics-based calculations
router.post('/physics', async (req, res) => {
  try {
    const metrics = req.body;
    
    if (!metrics) {
      return res.status(400).json({
        error: 'Metrics data is required'
      });
    }

    const analogyAgent = new AnalogyAgent();
    const physicsData = await analogyAgent.calculatePhysics(metrics);

    res.json({
      success: true,
      physics: physicsData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Physics calculation error:', error);
    res.status(500).json({
      error: 'Failed to calculate physics data'
    });
  }
});

// Generate mood-based analogy
router.post('/mood', async (req, res) => {
  try {
    const metrics = req.body;
    
    if (!metrics) {
      return res.status(400).json({
        error: 'Metrics data is required'
      });
    }

    const analogyAgent = new AnalogyAgent();
    const moodAnalogy = await analogyAgent.generateMoodBasedAnalogy(metrics);

    res.json({
      success: true,
      moodAnalogy,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Mood analogy error:', error);
    res.status(500).json({
      error: 'Failed to generate mood-based analogy'
    });
  }
});

// Batch generate analogies for multiple sessions
router.post('/batch', async (req, res) => {
  try {
    const { sessions } = req.body;
    
    if (!Array.isArray(sessions)) {
      return res.status(400).json({
        error: 'Sessions must be an array'
      });
    }

    const analogyAgent = new AnalogyAgent();
    const results = [];

    for (const session of sessions.slice(0, 10)) { // Limit to 10 for performance
      try {
        const analogy = await analogyAgent.generateAnalogy(session);
        results.push({
          sessionId: session.sessionId,
          analogy,
          success: true
        });
      } catch (sessionError) {
        results.push({
          sessionId: session.sessionId,
          error: sessionError.message,
          success: false
        });
      }
    }

    res.json({
      success: true,
      results,
      processed: results.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch analogy error:', error);
    res.status(500).json({
      error: 'Failed to generate batch analogies'
    });
  }
});

module.exports = router;
