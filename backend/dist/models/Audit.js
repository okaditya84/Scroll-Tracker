import { Schema, model } from 'mongoose';
const auditSchema = new Schema({
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorEmail: { type: String },
    action: { type: String, required: true },
    targetType: { type: String },
    targetId: { type: String },
    meta: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false } });
auditSchema.index({ actorId: 1, createdAt: -1 });
export default model('Audit', auditSchema);
