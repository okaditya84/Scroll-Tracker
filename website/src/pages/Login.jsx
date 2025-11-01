import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Auth.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: formData.email,
        password: formData.password
      });

      if (response.data.success) {
        // Store token
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // Redirect to dashboard
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    alert('Please use the Chrome extension for Google sign-in');
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-left">
          <Link to="/" className="back-button">
            ← Back to Home
          </Link>
          
          <div className="auth-content">
            <div className="auth-header">
              <h1>Welcome Back</h1>
              <p>Sign in to continue tracking your digital habits</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {error && (
                <div className="error-message">
                  <span>⚠️</span> {error}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div className="form-options">
                <label className="checkbox-label">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
                <a href="/forgot-password" className="forgot-link">Forgot password?</a>
              </div>

              <button 
                type="submit" 
                className="btn-submit"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>

              <div className="divider">
                <span>or</span>
              </div>

              <button 
                type="button" 
                className="btn-google"
                onClick={handleGoogleLogin}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>
            </form>

            <p className="auth-footer">
              Don't have an account? <Link to="/signup">Sign Up</Link>
            </p>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-visual">
            <h2>Track Your Digital Life</h2>
            <p>Get meaningful insights about your browsing habits</p>
            
            <div className="testimonial">
              <p className="testimonial-text">
                "ScrollWise helped me understand my browsing patterns and improve my productivity. The AI insights are both fun and actionable!"
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">JD</div>
                <div>
                  <p className="author-name">John Doe</p>
                  <p className="author-role">Software Engineer</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
