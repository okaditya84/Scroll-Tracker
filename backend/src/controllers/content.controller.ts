import { Request, Response } from 'express';
import Policy, { type PolicySlug } from '../models/Policy.js';
import ContactMessage from '../models/ContactMessage.js';

const defaultPolicies: Record<PolicySlug, { title: string; body: string }> = {
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

const ensurePolicy = async (slug: PolicySlug) => {
  const existing = await Policy.findOne({ slug });
  if (existing) return existing;
  const defaults = defaultPolicies[slug];
  return Policy.create({ slug, title: defaults.title, body: defaults.body });
};

export const getPolicy = async (req: Request, res: Response) => {
  const slug = req.params.slug as PolicySlug;
  if (!['terms', 'privacy', 'contact'].includes(slug)) {
    return res.status(404).json({ error: 'Policy not found' });
  }
  const policy = await ensurePolicy(slug);
  res.json({ slug: policy.slug, title: policy.title, body: policy.body, updatedAt: policy.updatedAt });
};

export const updatePolicy = async (req: Request, res: Response) => {
  const slug = req.params.slug as PolicySlug;
  if (!['terms', 'privacy', 'contact'].includes(slug)) {
    return res.status(404).json({ error: 'Policy not found' });
  }
  const { title, body } = req.body ?? {};
  const policy = await Policy.findOneAndUpdate(
    { slug },
    {
      $set: {
        title: title ?? defaultPolicies[slug].title,
        body: body ?? defaultPolicies[slug].body,
        updatedBy: (req as any).user?.email ?? 'admin'
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json({ slug: policy.slug, title: policy.title, body: policy.body, updatedAt: policy.updatedAt });
};

export const listPolicies = async (_req: Request, res: Response) => {
  const policies = await Promise.all((['terms', 'privacy', 'contact'] as PolicySlug[]).map(slug => ensurePolicy(slug)));
  res.json({ items: policies });
};

export const submitContactMessage = async (req: Request, res: Response) => {
  const { name, email, subject, message } = req.body ?? {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }
  const doc = await ContactMessage.create({
    name,
    email,
    subject,
    message,
    userId: (req as any).user?.sub
  });
  const id = typeof (doc as any)._id?.toString === 'function' ? (doc as any)._id.toString() : String((doc as any)._id ?? '');
  res.status(201).json({ id, createdAt: doc.createdAt });
};

export const listContactMessages = async (_req: Request, res: Response) => {
  const messages = await ContactMessage.find().sort({ createdAt: -1 }).lean();
  res.json({ items: messages });
};
