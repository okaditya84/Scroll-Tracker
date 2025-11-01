import jwt from 'jsonwebtoken';

const FALLBACK_SECRET = 'insecure-development-secret';
let hasWarnedAboutSecret = false;

function resolveSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && !hasWarnedAboutSecret) {
    hasWarnedAboutSecret = true;
    console.warn('[auth] JWT_SECRET is not set. Falling back to a weak development secret.');
  }
  return secret || FALLBACK_SECRET;
}

function extractToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  if (req.headers['x-access-token']) {
    return req.headers['x-access-token'];
  }

  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  if (req.query && typeof req.query.token === 'string') {
    return req.query.token;
  }

  return null;
}

export function generateToken(userId, options = {}) {
  if (!userId) {
    throw new Error('Cannot generate token without a user id');
  }

  const secret = resolveSecret();
  const payload = { sub: userId.toString() };
  const expiresIn = options.expiresIn || '7d';

  return jwt.sign(payload, secret, { expiresIn });
}

export function authenticateToken(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }

    const secret = resolveSecret();
    const decoded = jwt.verify(token, secret);
    const userId = decoded.sub || decoded.userId || decoded.id;

    if (!userId) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    req.userId = userId;
    req.token = token;

    return next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

export function optionalAuthenticate(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const secret = resolveSecret();
    const decoded = jwt.verify(token, secret);
    req.userId = decoded.sub || decoded.userId || decoded.id;
  } catch (error) {
    console.warn('Optional authentication failed:', error.message);
  }

  return next();
}
