const { ChatGroq } = require('@langchain/groq');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { RunnableSequence } = require('@langchain/core/runnables');

class AnalogyAgent {
  constructor() {
    this.llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.7,
      maxTokens: 1200, // Increased from 800 to prevent truncation
    });

    this.parser = new StringOutputParser();
    this.initializePrompts();
    this.initializeIconMapping();
  }

  initializeIconMapping() {
    // Map word descriptions to emojis for consistent icon handling
    this.iconMap = {
      'runner': '🏃‍♂️',
      'lightning': '⚡',
      'target': '🎯',
      'clock': '⏰',
      'fire': '🔥',
      'star': '⭐',
      'rocket': '🚀',
      'heart': '❤️',
      'trophy': '🏆',
      'gem': '💎',
      'muscle': '💪',
      'brain': '🧠',
      'eye': '👁️',
      'hand': '✋',
      'finger': '👆',
      'scroll': '📜',
      'mouse': '🖱️',
      'computer': '💻',
      'mobile': '📱',
      'speedometer': '📊',
      'thermometer': '🌡️',
      'battery': '🔋',
      'magnet': '🧲',
      'compass': '🧭',
      'microscope': '🔬',
      'telescope': '🔭',
      'atom': '⚛️',
      'dna': '🧬',
      'gear': '⚙️',
      'hammer': '🔨',
      'wrench': '🔧',
      'ruler': '📏',
      'scale': '⚖️',
      'hourglass': '⏳',
      'stopwatch': '⏱️',
      'alarm': '⏰',
      'calendar': '📅',
      'chart': '📈',
      'graph': '📊',
      'world': '🌍',
      'mountain': '⛰️',
      'building': '🏢',
      'house': '🏠',
      'car': '🚗',
      'plane': '✈️',
      'ship': '🚢',
      'bicycle': '🚲',
      'walking': '🚶‍♂️',
      'running': '🏃‍♂️',
      'swimming': '🏊‍♂️',
      'dancing': '💃',
      'climbing': '🧗‍♂️'
    };
  }

  initializePrompts() {
    // Ultra-concise analogy generation prompt to prevent truncation
    this.analogyPrompt = PromptTemplate.fromTemplate(`
Make 3 analogies for {distanceInMeters}m in {timeInSeconds}s. Return JSON:
{{"analogies":[{{"type":"distance","icon":"runner","comparison":"brief analogy"}},{{"type":"energy","icon":"lightning","comparison":"brief analogy"}},{{"type":"fun","icon":"target","comparison":"brief analogy"}}],"funFact":"brief fact","energy":"brief energy"}}
Keep comparisons under 30 chars.`);

    // Ultra-concise physics prompt
    this.physicsPrompt = PromptTemplate.fromTemplate(`
Return ONLY JSON for {distanceInMeters}m in {timeInSeconds}s:
{{"calories":0.01,"force":"light","work":"minimal","equivalent":"feather","explanation":"tiny"}}
No text, no markdown, just JSON.`);
  }

  parseAndCleanJSON(response) {
    if (!response || typeof response !== 'string' || response.trim().length === 0) {
      throw new Error('Empty or invalid response');
    }

    console.log('🧹 Raw response to clean:', response.substring(0, 500));

    let cleaned = response.trim();
    
    // Remove common markdown formatting
    cleaned = cleaned.replace(/```json\s*|\s*```/g, '');
    cleaned = cleaned.replace(/```\s*|\s*```/g, '');
    
    // Remove any text before the first {
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace > 0) {
      cleaned = cleaned.substring(firstBrace);
    }
    
    // Find the end of the JSON object more carefully
    let braceCount = 0;
    let inString = false;
    let escape = false;
    let jsonEnd = -1;
    
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      
      if (escape) {
        escape = false;
        continue;
      }
      
      if (char === '\\') {
        escape = true;
        continue;
      }
      
      if (char === '"' && !escape) {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
    }
    
    if (jsonEnd > 0) {
      cleaned = cleaned.substring(0, jsonEnd);
    }

    // Fix common JSON issues
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
    cleaned = cleaned.replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Quote unquoted keys
    
    // Fix unescaped quotes in strings (common issue)
    cleaned = cleaned.replace(/"([^"]*)"s([^"]*")/g, '"$1\'s$2'); // Replace "word"s with "word's"
    
    console.log('🧼 Cleaned JSON string:', cleaned.substring(0, 300));

    try {
      const parsed = JSON.parse(cleaned);
      console.log('✅ Successfully parsed JSON');
      return parsed;
    } catch (parseError) {
      console.log('❌ JSON parse failed, attempting repair...');
      
      // Try to repair common issues
      let repaired = cleaned;
      
      // Fix unterminated strings by finding and closing them
      const stringMatches = repaired.match(/"[^"]*$/gm);
      if (stringMatches) {
        stringMatches.forEach(match => {
          repaired = repaired.replace(match, match + '"');
        });
      }
      
      // If response is truncated, try to close incomplete structures
      if (!repaired.trim().endsWith('}')) {
        // Count open vs closed braces and brackets
        const openBraces = (repaired.match(/{/g) || []).length;
        const closeBraces = (repaired.match(/}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/]/g) || []).length;
        
        // Close missing brackets first
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          repaired += ']';
        }
        
        // Close missing braces
        for (let i = 0; i < openBraces - closeBraces; i++) {
          repaired += '}';
        }
        
        console.log('🔧 Attempted to close truncated JSON structure');
      }
      
      // Try parsing repaired version
      try {
        const repairedParsed = JSON.parse(repaired);
        console.log('🔧 Successfully parsed repaired JSON');
        return repairedParsed;
      } catch (repairError) {
        console.log('💥 All JSON repair attempts failed');
        console.log('🔍 Original error:', parseError.message);
        console.log('🔍 Repair error:', repairError.message);
        console.log('🔍 Cleaned response:', cleaned.substring(0, 500));
        throw new Error(`JSON parsing failed: ${parseError.message}`);
      }
    }
  }

  convertIconsToEmojis(analogyData) {
    if (analogyData.analogies && Array.isArray(analogyData.analogies)) {
      analogyData.analogies.forEach(analogy => {
        if (analogy.icon && typeof analogy.icon === 'string') {
          const emoji = this.iconMap[analogy.icon.toLowerCase()] || analogy.icon;
          analogy.icon = emoji;
        }
      });
    }
    return analogyData;
  }

  async generateAnalogy(metrics, retryCount = 0) {
    const maxRetries = 2;
    
    try {
      // Convert metrics to more usable units
      const distanceInMeters = (metrics.totalScrollDistance || 0) * 0.000264583;
      const timeInSeconds = (metrics.totalScrollTime || 0) / 1000;
      const sessionInSeconds = (metrics.sessionDuration || 0) / 1000;

      console.log('📊 Generating analogy for:', { distanceInMeters, timeInSeconds, attempt: retryCount + 1 });

      // Validate API key
      if (!process.env.GROQ_API_KEY) {
        console.error('❌ GROQ_API_KEY not found in environment variables');
        return this.getFallbackAnalogy(metrics);
      }

      // Create the chain
      const chain = RunnableSequence.from([
        this.analogyPrompt,
        this.llm,
        this.parser
      ]);

      // Generate analogies with timeout
      console.log('🔄 Calling Groq API...');
      const result = await Promise.race([
        chain.invoke({
          totalScrollDistance: metrics.totalScrollDistance || 0,
          totalScrollTime: metrics.totalScrollTime || 0,
          scrollEvents: metrics.scrollEvents || 0,
          sessionDuration: metrics.sessionDuration || 0,
          averageScrollSpeed: metrics.averageScrollSpeed || 0,
          distanceInMeters: distanceInMeters.toFixed(2),
          timeInSeconds: timeInSeconds.toFixed(1)
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('API call timeout')), 15000)
        )
      ]);

      console.log('🤖 LLM Raw Response (first 300 chars):', result ? result.substring(0, 300) : 'EMPTY RESPONSE');
      console.log('📏 Full response length:', result ? result.length : 0);

      if (!result || result.trim().length === 0) {
        console.log('❌ Empty response from Groq API');
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying... (${retryCount + 1}/${maxRetries})`);
          return this.generateAnalogy(metrics, retryCount + 1);
        }
        console.log('❌ Max retries reached, using fallback');
        return this.getFallbackAnalogy(metrics);
      }

      // Check if response appears truncated
      if (result.length < 50 || !result.includes('}')) {
        console.log('⚠️ Response appears truncated (length:', result.length, ')');
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying due to truncation... (${retryCount + 1}/${maxRetries})`);
          return this.generateAnalogy(metrics, retryCount + 1);
        }
      }

      // Use improved JSON parsing
      let analogyData;
      try {
        analogyData = this.parseAndCleanJSON(result);
        console.log('✅ Successfully parsed JSON response');
      } catch (parseError) {
        console.log('❌ JSON Parse Error:', parseError.message);
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying due to parse error... (${retryCount + 1}/${maxRetries})`);
          return this.generateAnalogy(metrics, retryCount + 1);
        }
        console.log('🔧 Max retries reached, falling back to default analogy');
        return this.getFallbackAnalogy(metrics);
      }

      // Validate the response structure
      if (!analogyData.analogies || !Array.isArray(analogyData.analogies)) {
        console.log('❌ Invalid response structure, using fallback');
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying due to invalid structure... (${retryCount + 1}/${maxRetries})`);
          return this.generateAnalogy(metrics, retryCount + 1);
        }
        return this.getFallbackAnalogy(metrics);
      }

      // Convert word-based icons to emojis
      analogyData = this.convertIconsToEmojis(analogyData);

      // Add physics calculations
      const physicsData = await this.calculatePhysics(metrics);
      
      return {
        ...analogyData,
        physics: physicsData,
        metadata: {
          distanceInMeters,
          timeInSeconds,
          sessionInSeconds,
          generatedAt: new Date().toISOString(),
          retryCount
        }
      };

    } catch (error) {
      console.error('❌ Analogy generation error:', error.message);
      console.error('🔍 Full error:', error);
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying due to error... (${retryCount + 1}/${maxRetries})`);
        return this.generateAnalogy(metrics, retryCount + 1);
      }
      return this.getFallbackAnalogy(metrics);
    }
  }

  async calculatePhysics(metrics) {
    try {
      const distanceInMeters = (metrics.totalScrollDistance || 0) * 0.000264583;
      const timeInSeconds = (metrics.totalScrollTime || 0) / 1000;

      const chain = RunnableSequence.from([
        this.physicsPrompt,
        this.llm,
        this.parser
      ]);

      const result = await chain.invoke({
        distanceInMeters: distanceInMeters.toFixed(3),
        timeInSeconds: timeInSeconds.toFixed(1),
        scrollEvents: metrics.scrollEvents || 0
      });

      console.log('🔬 Physics response (first 200 chars):', result ? result.substring(0, 200) : 'EMPTY');

      // Check if response contains non-JSON content (like LaTeX equations)
      if (result && (result.includes('\\text{') || result.includes('\\dfrac') || result.includes('**') || result.includes('|'))) {
        console.log('⚠️ Physics response contains formatted text instead of JSON, using fallback');
        return this.getFallbackPhysics(metrics);
      }

      try {
        return this.parseAndCleanJSON(result);
      } catch (parseError) {
        console.log('🔬 Physics JSON parse failed:', parseError.message);
        return this.getFallbackPhysics(metrics);
      }

    } catch (error) {
      console.error('Physics calculation error:', error);
      return this.getFallbackPhysics(metrics);
    }
  }

  async generateMoodBasedAnalogy(metrics) {
    // Simplified mood analysis
    const speed = metrics.averageScrollSpeed || 0;
    const time = metrics.sessionDuration || 0;
    
    let mood = 'relaxed';
    if (speed > 1000) mood = 'speedy';
    if (time > 300000) mood = 'focused';
    
    return {
      mood,
      message: `You seem to be in a ${mood} browsing mood today!`,
      suggestion: 'Keep enjoying your digital journey!'
    };
  }

  getFallbackAnalogy(metrics) {
    const distance = (metrics.totalScrollDistance || 0) * 0.000264583;
    const time = (metrics.totalScrollTime || 0) / 1000;
    
    return {
      analogies: [
        {
          type: 'distance',
          icon: '🏃‍♂️',
          comparison: distance > 10 
            ? `You scrolled ${distance.toFixed(1)}m - like crossing a large room!`
            : `You scrolled ${distance.toFixed(1)}m - like taking a few steps!`
        },
        {
          type: 'energy',
          icon: '⚡',
          comparison: time > 60 
            ? `${time.toFixed(0)}s of scrolling - like a mini finger workout!`
            : `${time.toFixed(0)}s of quick scrolling!`
        },
        {
          type: 'fun',
          icon: '🎯',
          comparison: `Your finger traveled like a determined ant exploring ${Math.floor(distance * 100)}cm!`
        }
      ],
      funFact: "Did you know? The average person scrolls through about 300 feet of content daily!",
      energy: `Your scrolling burned approximately ${(distance * 0.05).toFixed(3)} calories - like a quick blink!`
    };
  }

  getFallbackPhysics(metrics) {
    const distance = (metrics.totalScrollDistance || 0) * 0.000264583;
    const estimatedCalories = Math.max(0.001, distance * 0.0001);
    
    return {
      calories: estimatedCalories,
      force: "Very light finger pressure",
      work: `About ${(estimatedCalories * 1000).toFixed(0)} millijoules`,
      equivalent: "Like lifting a feather",
      explanation: "Scrolling uses minimal physical energy but engages your mind!"
    };
  }
}

module.exports = AnalogyAgent;
