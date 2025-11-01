// API utility for backend communication
const API_URL = 'https://your-backend.onrender.com/api';

export async function saveActivityData(userId, accessToken, activityData) {
  try {
    const response = await fetch(`${API_URL}/activity/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        userId,
        ...activityData,
        timestamp: Date.now()
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Save activity error:', error);
    return false;
  }
}

export async function syncWithServer(userId, accessToken, data) {
  try {
    const response = await fetch(`${API_URL}/activity/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        userId,
        ...data
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Sync error:', error);
    return false;
  }
}
