const mongoose = require('mongoose');

const scrollEventSchema = new mongoose.Schema({
  startY: { type: Number, required: true },
  endY: { type: Number, required: true },
  distance: { type: Number, required: true },
  duration: { type: Number, required: true },
  timestamp: { type: Date, required: true },
  url: { type: String, required: true },
  title: { type: String, required: true }
});

const scrollSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Allow anonymous sessions
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  startTime: {
    type: Date,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  totalScrollDistance: {
    type: Number,
    default: 0
  },
  totalScrollTime: {
    type: Number,
    default: 0
  },
  scrollEvents: [scrollEventSchema],
  pageHeight: {
    type: Number,
    default: 0
  },
  viewportHeight: {
    type: Number,
    default: 0
  },
  url: String,
  title: String,
  userAgent: String,
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet'],
    default: 'desktop'
  },
  // Calculated fields
  averageScrollSpeed: {
    type: Number,
    default: 0
  },
  sessionDuration: {
    type: Number,
    default: 0
  },
  // Analytics
  analogiesGenerated: [{
    type: {
      type: String,
      enum: ['distance', 'time', 'energy', 'comparison']
    },
    content: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for performance
scrollSessionSchema.index({ userId: 1, startTime: -1 });
scrollSessionSchema.index({ sessionId: 1 });
scrollSessionSchema.index({ startTime: -1 });

// Virtual for session duration
scrollSessionSchema.virtual('calculatedSessionDuration').get(function() {
  return this.lastUpdated - this.startTime;
});

// Virtual for average scroll speed
scrollSessionSchema.virtual('calculatedAverageScrollSpeed').get(function() {
  return this.totalScrollTime > 0 
    ? this.totalScrollDistance / (this.totalScrollTime / 1000) 
    : 0;
});

// Pre-save middleware to calculate derived values
scrollSessionSchema.pre('save', function(next) {
  this.sessionDuration = this.lastUpdated - this.startTime;
  this.averageScrollSpeed = this.totalScrollTime > 0 
    ? this.totalScrollDistance / (this.totalScrollTime / 1000) 
    : 0;
  next();
});

// Instance methods
scrollSessionSchema.methods.addScrollEvent = function(eventData) {
  this.scrollEvents.push(eventData);
  this.totalScrollDistance += eventData.distance;
  this.totalScrollTime += eventData.duration;
  this.lastUpdated = new Date();
  return this.save();
};

scrollSessionSchema.methods.getMetrics = function() {
  return {
    sessionId: this.sessionId,
    totalScrollDistance: this.totalScrollDistance,
    totalScrollTime: this.totalScrollTime,
    scrollEvents: this.scrollEvents.length,
    averageScrollSpeed: this.averageScrollSpeed,
    sessionDuration: this.sessionDuration,
    startTime: this.startTime,
    lastUpdated: this.lastUpdated,
    url: this.url,
    title: this.title
  };
};

// Static methods
scrollSessionSchema.statics.getSessionsByUser = function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ startTime: -1 })
    .limit(limit)
    .exec();
};

scrollSessionSchema.statics.getSessionStats = function(userId, dateRange) {
  const matchStage = userId ? { userId } : {};
  
  if (dateRange) {
    matchStage.startTime = {
      $gte: dateRange.start,
      $lte: dateRange.end
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalScrollDistance: { $sum: '$totalScrollDistance' },
        totalScrollTime: { $sum: '$totalScrollTime' },
        totalSessionTime: { $sum: '$sessionDuration' },
        averageScrollSpeed: { $avg: '$averageScrollSpeed' },
        totalScrollEvents: { $sum: { $size: '$scrollEvents' } }
      }
    }
  ]);
};

scrollSessionSchema.statics.getDailyStats = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const matchStage = { startTime: { $gte: startDate } };
  if (userId) matchStage.userId = userId;

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: '$startTime' },
          month: { $month: '$startTime' },
          day: { $dayOfMonth: '$startTime' }
        },
        date: { $first: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } } },
        sessions: { $sum: 1 },
        totalDistance: { $sum: '$totalScrollDistance' },
        totalTime: { $sum: '$totalScrollTime' },
        avgSpeed: { $avg: '$averageScrollSpeed' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);
};

module.exports = mongoose.model('ScrollSession', scrollSessionSchema);
