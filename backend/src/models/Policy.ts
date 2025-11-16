import { Document, Schema, model } from 'mongoose';

export type PolicySlug = 'terms' | 'privacy' | 'contact';

export interface PolicyDocument extends Document {
  slug: PolicySlug;
  title: string;
  body: string;
  updatedBy?: string;
  updatedAt: Date;
  createdAt: Date;
}

const policySchema = new Schema<PolicyDocument>(
  {
    slug: { type: String, enum: ['terms', 'privacy', 'contact'], unique: true, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    updatedBy: { type: String }
  },
  { timestamps: true }
);

export default model<PolicyDocument>('Policy', policySchema);
