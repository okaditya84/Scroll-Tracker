import mongoose from 'mongoose';

const dailyStatsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  stats: {
    totalScrolls: { type: Number, default: 0 },
    totalClicks: { type: Number, default: 0 },
    totalMouseMovements: { type: Number, default: 0 },
    totalKeystrokes: { type: Number, default: 0 },
    totalTabSwitches: { type: Number, default: 0 },
    totalActiveTime: { type: Number, default: 0 },
    totalIdleTime: { type: Number, default: 0 }
  },
  hourlyBreakdown: [{
    hour: { type: Number, min: 0, max: 23 },
    scrolls: Number,
    clicks: Number,
    activeTime: Number
  }],
  topWebsites: [{
    url: String,
    domain: String,
    visits: Number,
    timeSpent: Number,
    scrolls: Number,
    clicks: Number
  }],
  insights: [{
    text: String,
    category: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high']
    }
  }]
}, {
  timestamps: true
});

// Compound index for efficient user + date queries
dailyStatsSchema.index({ userId: 1, date: -1 }, { unique: true });

export default mongoose.model('DailyStats', dailyStatsSchema);
