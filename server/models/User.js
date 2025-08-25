const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  username: {
    type: String,
    required: false,
    trim: true,
    maxlength: 50
  },
  settings: {
    enableTracking: {
      type: Boolean,
      default: true
    },
    syncToServer: {
      type: Boolean,
      default: true
    },
    showNotifications: {
      type: Boolean,
      default: true
    },
    analogyLevel: {
      type: String,
      enum: ['basic', 'creative', 'scientific'],
      default: 'creative'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'dark'
    },
    dailyGoal: {
      type: Number,
      default: 10000 // pixels
    }
  },
  stats: {
    totalSessions: {
      type: Number,
      default: 0
    },
    totalScrollDistance: {
      type: Number,
      default: 0
    },
    totalScrollTime: {
      type: Number,
      default: 0
    },
    joinDate: {
      type: Date,
      default: Date.now
    },
    lastActive: {
      type: Date,
      default: Date.now
    },
    streak: {
      current: {
        type: Number,
        default: 0
      },
      longest: {
        type: Number,
        default: 0
      },
      lastActivityDate: {
        type: Date,
        default: Date.now
      }
    }
  },
  achievements: [{
    name: String,
    description: String,
    unlockedAt: {
      type: Date,
      default: Date.now
    },
    icon: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ 'stats.lastActive': -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

userSchema.methods.updateStats = function(sessionData) {
  this.stats.totalSessions += 1;
  this.stats.totalScrollDistance += sessionData.totalScrollDistance || 0;
  this.stats.totalScrollTime += sessionData.totalScrollTime || 0;
  this.stats.lastActive = new Date();
  
  // Update streak
  this.updateStreak();
  
  return this.save();
};

userSchema.methods.updateStreak = function() {
  const today = new Date();
  const lastActivity = new Date(this.stats.streak.lastActivityDate);
  
  // Reset time to start of day for comparison
  today.setHours(0, 0, 0, 0);
  lastActivity.setHours(0, 0, 0, 0);
  
  const daysDiff = Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24));
  
  if (daysDiff === 0) {
    // Same day, no change to streak
    return;
  } else if (daysDiff === 1) {
    // Consecutive day, increment streak
    this.stats.streak.current += 1;
    if (this.stats.streak.current > this.stats.streak.longest) {
      this.stats.streak.longest = this.stats.streak.current;
    }
  } else {
    // Streak broken, reset
    this.stats.streak.current = 1;
  }
  
  this.stats.streak.lastActivityDate = new Date();
};

userSchema.methods.checkAchievements = function() {
  const achievements = [];
  
  // Distance achievements
  if (this.stats.totalScrollDistance >= 1000000 && !this.hasAchievement('distance_1000k')) {
    achievements.push({
      name: 'distance_1000k',
      description: 'Scrolled 1,000,000 pixels!',
      icon: '🏔️'
    });
  }
  
  // Time achievements
  if (this.stats.totalScrollTime >= 3600000 && !this.hasAchievement('time_1hour')) {
    achievements.push({
      name: 'time_1hour',
      description: 'Spent 1 hour scrolling!',
      icon: '⏰'
    });
  }
  
  // Streak achievements
  if (this.stats.streak.longest >= 7 && !this.hasAchievement('streak_week')) {
    achievements.push({
      name: 'streak_week',
      description: '7-day scrolling streak!',
      icon: '🔥'
    });
  }
  
  // Add new achievements
  achievements.forEach(achievement => {
    this.achievements.push(achievement);
  });
  
  return achievements;
};

userSchema.methods.hasAchievement = function(achievementName) {
  return this.achievements.some(achievement => achievement.name === achievementName);
};

userSchema.methods.toSafeObject = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.getLeaderboard = function(limit = 10, type = 'distance') {
  const sortField = type === 'distance' 
    ? 'stats.totalScrollDistance' 
    : type === 'time' 
    ? 'stats.totalScrollTime'
    : 'stats.totalSessions';
    
  return this.find({ isActive: true })
    .select('username stats achievements')
    .sort({ [sortField]: -1 })
    .limit(limit)
    .exec();
};

userSchema.statics.getActiveUsers = function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.countDocuments({
    'stats.lastActive': { $gte: cutoffDate },
    isActive: true
  });
};

module.exports = mongoose.model('User', userSchema);
