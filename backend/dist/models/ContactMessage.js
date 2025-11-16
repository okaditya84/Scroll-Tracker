import { Schema, model } from 'mongoose';
const contactMessageSchema = new Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, trim: true },
    message: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
export default model('ContactMessage', contactMessageSchema);
