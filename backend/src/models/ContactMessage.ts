import { Document, Schema, model } from 'mongoose';

export interface ContactMessageDocument extends Document {
  name: string;
  email: string;
  subject?: string;
  message: string;
  userId?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const contactMessageSchema = new Schema<ContactMessageDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, trim: true },
    message: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export default model<ContactMessageDocument>('ContactMessage', contactMessageSchema);
