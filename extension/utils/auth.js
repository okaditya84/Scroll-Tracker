// Authentication utility
const API_URL = 'https://your-backend.onrender.com/api';

export async function loginWithGoogle() {
  try {
    // Launch OAuth flow
    const redirectURL = chrome.identity.getRedirectURL();
    const clientId = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
    const scopes = ['profile', 'email'];
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectURL)}&scope=${encodeURIComponent(scopes.join(' '))}`;
    
    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, (redirectUrl) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(redirectUrl);
        }
      });
    });
    
    // Extract token from URL
    const urlParams = new URLSearchParams(responseUrl.split('#')[1]);
    const googleAccessToken = urlParams.get('access_token');
    
    if (!googleAccessToken) {
      throw new Error('No access token received');
    }
    
    // Exchange Google token for our app token
    const response = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ googleAccessToken })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return {
        success: true,
        userId: data.user.id,
        accessToken: data.accessToken,
        user: data.user
      };
    } else {
      throw new Error(data.message || 'Authentication failed');
    }
  } catch (error) {
    console.error('Google login error:', error);
    return { success: false, error: error.message };
  }
}

export async function loginWithEmail(email, password) {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return {
        success: true,
        userId: data.user.id,
        accessToken: data.accessToken,
        user: data.user
      };
    } else {
      throw new Error(data.message || 'Authentication failed');
    }
  } catch (error) {
    console.error('Email login error:', error);
    return { success: false, error: error.message };
  }
}

export async function getUserProfile(accessToken) {
  try {
    const response = await fetch(`${API_URL}/auth/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      return data.user;
    } else {
      throw new Error('Failed to get user profile');
    }
  } catch (error) {
    console.error('Get profile error:', error);
    return null;
  }
}

export async function logout() {
  await chrome.storage.local.clear();
}
