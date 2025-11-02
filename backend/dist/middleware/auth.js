import jwt from 'jsonwebtoken';
import env from '../config/env.js';
const requireAuth = (req, res, next) => {
    const raw = req.headers['authorization'];
    const authHeader = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) {
        return res.status(401).json({ error: 'Missing token' });
    }
    try {
        const payload = jwt.verify(token, env.JWT_SECRET);
        req.user = payload;
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
    }
};
export default requireAuth;
