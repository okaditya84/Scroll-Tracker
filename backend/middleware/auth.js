import express from 'express';
import axios from 'axios';
import User from '../models/User.js';
import { authenticateToken, generateToken } from '../middleware/auth.js';

const router = express.Router();

// Google OAuth Login
router.post('/google', async (req, res) => {
  try {
    const { googleAccessToken } = req.body;
    
    if (!googleAccessToken) {
      return res.status(400).json({ error: 'Google access token required' });
    }
    
    // Verify Google token and get user info
    const googleResponse = await axios.get(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${googleAccessToken}`
    );
    
    const { sub: googleId, email, name, picture } = googleResponse.data;
    
    // Find or create user
    let user = await User.findOne({ 
      $or: [{ googleId }, { email }] 
    });
    
    if (user) {
      // Update existing user
      user.googleId = googleId;
      user.name = name;
      user.picture = picture;
      user.authProvider = 'google';
      user.metadata.lastLogin = new Date();
      user.metadata.loginCount += 1;
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        email,
        name,
        picture,
        googleId,
        authProvider: 'google',
        metadata: {
          lastLogin: new Date(),
          loginCount: 1
        }
      });
    }
    
    // Generate JWT token
    const accessToken = generateToken(user._id);
    
    res.json({
      success: true,
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
    
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message 
    });
  }
});

// Email/Password Registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Create user
    const user = await User.create({
      email,
      password,
      name,
      authProvider: 'email',
      metadata: {
        lastLogin: new Date(),
        loginCount: 1
      }
    });
    
    // Generate token
    const accessToken = generateToken(user._id);
    
    res.status(201).json({
      success: true,
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Email/Password Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const user = await User.findOne({ email, authProvider: 'email' });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update login metadata
    user.metadata.lastLogin = new Date();
    user.metadata.loginCount += 1;
    await user.save();
    
    // Generate token
    const accessToken = generateToken(user._id);
    
    res.json({
      success: true,
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
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
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
