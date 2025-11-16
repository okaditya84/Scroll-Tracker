import { Schema, model } from 'mongoose';
const policySchema = new Schema({
    slug: { type: String, enum: ['terms', 'privacy', 'contact'], unique: true, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    updatedBy: { type: String }
}, { timestamps: true });
export default model('Policy', policySchema);
