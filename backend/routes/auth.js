import express from 'express';
import axios from 'axios';
import User from '../models/User.js';
import { authenticateToken, generateToken } from '../middleware/auth.js';

const router = express.Router();

function updateLoginMetadata(user) {
  user.metadata = user.metadata || {};
  user.metadata.lastLogin = new Date();
  user.metadata.loginCount = (user.metadata.loginCount || 0) + 1;
}

function sanitizeUser(user) {
  const doc = typeof user.toObject === 'function' ? user.toObject() : user;
  const { _id, email, name, picture, authProvider, metadata, preferences } = doc;
  return {
    id: _id,
    email,
    name,
    picture,
    authProvider,
    metadata,
    preferences
  };
}

router.post('/google', async (req, res) => {
  try {
    const { googleAccessToken } = req.body;

    if (!googleAccessToken) {
      return res.status(400).json({ error: 'Google access token required' });
    }

    const googleResponse = await axios.get(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${googleAccessToken}`
    );

    const { sub: googleId, email, name, picture } = googleResponse.data;

    let user = await User.findOne({
      $or: [{ googleId }, { email }]
    });

    if (user) {
      user.googleId = googleId;
      user.name = name || user.name;
      user.picture = picture || user.picture;
      user.authProvider = 'google';
      updateLoginMetadata(user);
      await user.save();
    } else {
      user = await User.create({
        email,
        name,
        picture,
        googleId,
        authProvider: 'google',
        metadata: {
          lastLogin: new Date(),
          loginCount: 1,
          extensionInstalled: false
        }
      });
    }

    const accessToken = generateToken(user._id);

    return res.json({
      success: true,
      accessToken,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const user = await User.create({
      email,
      password,
      name,
      authProvider: 'email',
      metadata: {
        lastLogin: new Date(),
        loginCount: 1,
        extensionInstalled: false
      }
    });

    const accessToken = generateToken(user._id);

    return res.status(201).json({
      success: true,
      accessToken,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Registration error:', error);

    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email, authProvider: 'email' });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    updateLoginMetadata(user);
    await user.save();

    const accessToken = generateToken(user._id);

    return res.json({
      success: true,
      accessToken,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      success: true,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.patch('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, preferences } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (preferences) updateData.preferences = preferences;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      success: true,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
