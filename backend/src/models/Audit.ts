import { Document, Schema, model } from 'mongoose';

export interface AuditDocument extends Document {
  actorId?: Schema.Types.ObjectId | string;
  actorEmail?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const auditSchema = new Schema<AuditDocument>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorEmail: { type: String },
    action: { type: String, required: true },
    targetType: { type: String },
    targetId: { type: String },
    meta: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditSchema.index({ actorId: 1, createdAt: -1 });

export default model<AuditDocument>('Audit', auditSchema);
