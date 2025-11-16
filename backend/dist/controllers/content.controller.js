import Policy from '../models/Policy.js';
import ContactMessage from '../models/ContactMessage.js';
const defaultPolicies = {
    terms: {
        title: 'Terms & Conditions',
        body: 'These Terms govern your access to Scrollwise. Use Scrollwise responsibly and comply with applicable laws.'
    },
    privacy: {
        title: 'Privacy Policy',
        body: 'We collect activity telemetry to provide insights. We never sell data to advertisers and honor deletion requests within 30 days.'
    },
    contact: {
        title: 'Contact Scrollwise',
        body: 'Reach our team at hello@scrollwise.app for billing, partnerships, or support questions.'
    }
};
const ensurePolicy = async (slug) => {
    const existing = await Policy.findOne({ slug });
    if (existing)
        return existing;
    const defaults = defaultPolicies[slug];
    return Policy.create({ slug, title: defaults.title, body: defaults.body });
};
export const getPolicy = async (req, res) => {
    const slug = req.params.slug;
    if (!['terms', 'privacy', 'contact'].includes(slug)) {
        return res.status(404).json({ error: 'Policy not found' });
    }
    const policy = await ensurePolicy(slug);
    res.json({ slug: policy.slug, title: policy.title, body: policy.body, updatedAt: policy.updatedAt });
};
export const updatePolicy = async (req, res) => {
    const slug = req.params.slug;
    if (!['terms', 'privacy', 'contact'].includes(slug)) {
        return res.status(404).json({ error: 'Policy not found' });
    }
    const { title, body } = req.body ?? {};
    const policy = await Policy.findOneAndUpdate({ slug }, {
        $set: {
            title: title ?? defaultPolicies[slug].title,
            body: body ?? defaultPolicies[slug].body,
            updatedBy: req.user?.email ?? 'admin'
        }
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ slug: policy.slug, title: policy.title, body: policy.body, updatedAt: policy.updatedAt });
};
export const listPolicies = async (_req, res) => {
    const policies = await Promise.all(['terms', 'privacy', 'contact'].map(slug => ensurePolicy(slug)));
    res.json({ items: policies });
};
export const submitContactMessage = async (req, res) => {
    const { name, email, subject, message } = req.body ?? {};
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required' });
    }
    const doc = await ContactMessage.create({
        name,
        email,
        subject,
        message,
        userId: req.user?.sub
    });
    const id = typeof doc._id?.toString === 'function' ? doc._id.toString() : String(doc._id ?? '');
    res.status(201).json({ id, createdAt: doc.createdAt });
};
export const listContactMessages = async (_req, res) => {
    const messages = await ContactMessage.find().sort({ createdAt: -1 }).lean();
    res.json({ items: messages });
};
