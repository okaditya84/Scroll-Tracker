import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  sessionData: {
    scrolls: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    mouseMovements: {
      type: Number,
      default: 0
    },
    keystrokes: {
      type: Number,
      default: 0
    },
    tabSwitches: {
      type: Number,
      default: 0
    },
    activeTime: {
      type: Number,
      default: 0
    },
    idleTime: {
      type: Number,
      default: 0
    }
  },
  activityLogs: [{
    timestamp: Date,
    tabId: String,
    url: String,
    title: String,
    scrolls: Number,
    clicks: Number,
    mouseMovements: Number,
    activeTime: Number
  }],
  insights: [{
    text: String,
    category: {
      type: String,
      enum: ['productivity', 'health', 'fun', 'comparison']
    },
    generatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  statistics: {
    totalCaloriesBurned: Number,
    totalDistanceScrolled: Number,
    avgClicksPerHour: Number,
    mostActiveHour: Number,
    productivityScore: Number
  }
}, {
  timestamps: true
});

// Index for efficient queries
activitySchema.index({ userId: 1, date: -1 });
activitySchema.index({ userId: 1, createdAt: -1 });

// Calculate statistics before saving
activitySchema.pre('save', function(next) {
  if (this.sessionData) {
    // Calculate calories (rough estimate: 1 click = 0.01 cal, 1 scroll = 0.005 cal)
    this.statistics.totalCaloriesBurned = 
      (this.sessionData.clicks * 0.01) + 
      (this.sessionData.scrolls * 0.005);
    
    // Calculate distance scrolled (estimate: 1 scroll = 100 pixels = 0.1 meters)
    this.statistics.totalDistanceScrolled = this.sessionData.scrolls * 0.1;
    
    // Calculate avg clicks per hour
    if (this.sessionData.activeTime > 0) {
      this.statistics.avgClicksPerHour = 
        (this.sessionData.clicks / (this.sessionData.activeTime / 3600));
    }
  }
  next();
});

export default mongoose.model('Activity', activitySchema);
