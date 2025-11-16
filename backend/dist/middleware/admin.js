import basicAuth from 'basic-auth';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';
// Admin middleware: allow either a verified JWT with role admin/superadmin
// or HTTP Basic auth with SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD from env.
const isAdmin = async (req, res, next) => {
    if (req.user?.role === 'admin' || req.user?.role === 'superadmin') {
        return next();
    }
    // 1) Bearer token path
    const raw = req.headers['authorization'];
    const authHeader = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (token) {
        try {
            const payload = jwt.verify(token, env.JWT_SECRET);
            // if token includes a role claim, allow admin roles
            if (payload?.role === 'admin' || payload?.role === 'superadmin') {
                req.user = payload;
                return next();
            }
            // fallback: ensure subject maps to a user with an admin role
            if (payload?.sub) {
                const user = await User.findById(payload.sub).select('role');
                if (user && (user.role === 'admin' || user.role === 'superadmin')) {
                    req.user = payload;
                    return next();
                }
            }
        }
        catch {
            // continue to basic auth fallback
        }
    }
    // 2) Basic auth fallback against SUPERADMIN creds
    const credentials = basicAuth(req);
    if (credentials && env.SUPERADMIN_EMAIL && env.SUPERADMIN_PASSWORD) {
        if (credentials.name === env.SUPERADMIN_EMAIL && credentials.pass === env.SUPERADMIN_PASSWORD) {
            // attach a synthetic user payload
            req.user = { sub: 'superadmin', email: env.SUPERADMIN_EMAIL, role: 'superadmin' };
            return next();
        }
    }
    return res.status(403).json({ error: 'Admin access required' });
};
export default isAdmin;
