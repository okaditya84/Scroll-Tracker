import { Schema, model } from 'mongoose';
const userSchema = new Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String },
    timezone: { type: String, default: 'UTC' },
    role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
    habits: {
        dailyGoalMinutes: { type: Number, default: 120 },
        notificationsEnabled: { type: Boolean, default: true }
    }
}, { timestamps: true });
export default model('User', userSchema);
