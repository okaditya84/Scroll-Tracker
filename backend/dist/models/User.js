import { Schema, model } from 'mongoose';
const userSchema = new Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String },
    timezone: { type: String, default: 'UTC' },
    role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
    accountStatus: { type: String, enum: ['active', 'invited', 'suspended'], default: 'active' },
    habits: {
        dailyGoalMinutes: { type: Number, default: 120 },
        notificationsEnabled: { type: Boolean, default: true }
    },
    tracking: {
        paused: { type: Boolean, default: false },
        pausedAt: { type: Date },
        reason: { type: String, trim: true, maxlength: 512 }
    },
    presence: {
        lastEventAt: { type: Date },
        lastEventType: { type: String },
        lastUrl: { type: String },
        lastDomain: { type: String },
        lastDurationMs: { type: Number },
        lastScrollDistance: { type: Number }
    },
    contact: {
        phone: { type: String, trim: true },
        company: { type: String, trim: true },
        jobTitle: { type: String, trim: true },
        location: { type: String, trim: true }
    }
}, { timestamps: true });
export default model('User', userSchema);
