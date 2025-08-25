const mongoose = require('mongoose');

const scrollSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  website: {
    type: String,
    required: true,
    index: true
  },
  url: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  startTime: {
    type: Date,
    required: true,
    index: true
  },
  lastUpdated: {
    type: Date,
    required: true,
    default: Date.now
  },
  totalScrollDistance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalScrollTime: {
    type: Number,
    default: 0,
    min: 0
  },
  scrollEvents: {
    type: Number,
    default: 0,
    min: 0
  },
  maxScrollDepth: {
    type: Number,
    default: 0,
    min: 0
  },
  deviceInfo: {
    userAgent: String,
    screenWidth: Number,
    screenHeight: Number,
    deviceType: {
      type: String,
      enum: ['desktop', 'tablet', 'mobile'],
      default: 'desktop'
    }
  },
  scrollPattern: {
    averageSpeed: {
      type: Number,
      default: 0
    },
    peakSpeed: {
      type: Number,
      default: 0
    },
    pauseCount: {
      type: Number,
      default: 0
    },
    direction: {
      up: { type: Number, default: 0 },
      down: { type: Number, default: 0 }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String,
    index: true
  }],
  metadata: {
    timeZone: String,
    language: String,
    referrer: String
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes for efficient queries
scrollSessionSchema.index({ userId: 1, startTime: -1 });
scrollSessionSchema.index({ userId: 1, website: 1, startTime: -1 });
scrollSessionSchema.index({ sessionId: 1, userId: 1 });
scrollSessionSchema.index({ startTime: -1, isActive: 1 });

// Methods
scrollSessionSchema.methods.getDuration = function() {
  return this.lastUpdated - this.startTime;
};

scrollSessionSchema.methods.getAverageSpeed = function() {
  const durationInSeconds = this.getDuration() / 1000;
  return durationInSeconds > 0 ? this.totalScrollDistance / durationInSeconds : 0;
};

scrollSessionSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Static methods
scrollSessionSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId, isActive: true };
  
  if (options.website) {
    query.website = options.website;
  }
  
  if (options.startDate && options.endDate) {
    query.startTime = {
      $gte: new Date(options.startDate),
      $lte: new Date(options.endDate)
    };
  }
  
  return this.find(query)
    .sort({ startTime: -1 })
    .limit(options.limit || 100);
};

scrollSessionSchema.statics.getSessionStats = function(userId, period = 'all') {
  const match = { userId: mongoose.Types.ObjectId(userId), isActive: true };
  
  // Add date filtering based on period
  const now = new Date();
  if (period === 'today') {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    match.startTime = { $gte: startOfDay };
  } else if (period === 'week') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    match.startTime = { $gte: startOfWeek };
  } else if (period === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    match.startTime = { $gte: startOfMonth };
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalScrollDistance: { $sum: '$totalScrollDistance' },
        totalScrollTime: { $sum: '$totalScrollTime' },
        totalEvents: { $sum: '$scrollEvents' },
        averageScrollDistance: { $avg: '$totalScrollDistance' },
        averageScrollTime: { $avg: '$totalScrollTime' },
        maxScrollDistance: { $max: '$totalScrollDistance' },
        totalDuration: { $sum: { $subtract: ['$lastUpdated', '$startTime'] } }
      }
    },
    {
      $project: {
        _id: 0,
        totalSessions: 1,
        totalScrollDistance: 1,
        totalScrollTime: 1,
        totalEvents: 1,
        averageScrollDistance: { $round: ['$averageScrollDistance', 2] },
        averageScrollTime: { $round: ['$averageScrollTime', 2] },
        maxScrollDistance: 1,
        totalDuration: 1,
        averageSpeed: {
          $cond: {
            if: { $gt: ['$totalScrollTime', 0] },
            then: { $round: [{ $divide: ['$totalScrollDistance', { $divide: ['$totalScrollTime', 1000] }] }, 2] },
            else: 0
          }
        }
      }
    }
  ]);
};

scrollSessionSchema.statics.getTopWebsites = function(userId, limit = 10) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId), isActive: true } },
    {
      $group: {
        _id: '$website',
        totalSessions: { $sum: 1 },
        totalScrollDistance: { $sum: '$totalScrollDistance' },
        totalTime: { $sum: { $subtract: ['$lastUpdated', '$startTime'] } },
        lastVisit: { $max: '$startTime' }
      }
    },
    { $sort: { totalScrollDistance: -1 } },
    { $limit: limit },
    {
      $project: {
        website: '$_id',
        totalSessions: 1,
        totalScrollDistance: 1,
        totalTime: 1,
        lastVisit: 1,
        _id: 0
      }
    }
  ]);
};

scrollSessionSchema.statics.getActivityTimeline = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        startTime: { $gte: startDate },
        isActive: true
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$startTime'
          }
        },
        sessions: { $sum: 1 },
        totalScrollDistance: { $sum: '$totalScrollDistance' },
        totalTime: { $sum: { $subtract: ['$lastUpdated', '$startTime'] } }
      }
    },
    { $sort: { '_id': 1 } },
    {
      $project: {
        date: '$_id',
        sessions: 1,
        totalScrollDistance: 1,
        totalTime: 1,
        _id: 0
      }
    }
  ]);
};

// Pre-save middleware
scrollSessionSchema.pre('save', function(next) {
  if (this.isNew) {
    // Set default values for new sessions
    this.lastUpdated = new Date();
    
    // Extract website from URL if not provided
    if (!this.website && this.url) {
      try {
        const urlObj = new URL(this.url);
        this.website = urlObj.hostname;
      } catch (error) {
        this.website = 'unknown';
      }
    }
    
    // Determine device type from user agent
    if (this.deviceInfo && this.deviceInfo.userAgent) {
      const ua = this.deviceInfo.userAgent.toLowerCase();
      if (ua.includes('mobile')) {
        this.deviceInfo.deviceType = 'mobile';
      } else if (ua.includes('tablet')) {
        this.deviceInfo.deviceType = 'tablet';
      } else {
        this.deviceInfo.deviceType = 'desktop';
      }
    }
  }
  
  // Update computed fields
  if (this.totalScrollTime > 0) {
    this.scrollPattern.averageSpeed = this.totalScrollDistance / (this.totalScrollTime / 1000);
  }
  
  next();
});

// Post-save middleware
scrollSessionSchema.post('save', function(doc) {
  // Could trigger analytics updates, notifications, etc.
  console.log(`📊 Session saved: ${doc.sessionId} (${doc.totalScrollDistance}px)`);
});

const ScrollSession = mongoose.model('ScrollSession', scrollSessionSchema);

module.exports = ScrollSession;
