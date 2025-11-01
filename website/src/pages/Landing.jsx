import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Landing.css';

function Landing() {
  return (
    <div className="landing">
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            <span className="logo-icon">📊</span>
            <span className="logo-text">ScrollWise</span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#insights">Insights</a>
            <Link to="/login" className="btn-login">Login</Link>
            <Link to="/signup" className="btn-cta">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">
              Understand Your
              <span className="gradient-text"> Digital Habits</span>
            </h1>
            <p className="hero-subtitle">
              Track your scrolling, clicks, and browsing patterns with fun AI-powered insights. 
              Discover how much time you spend online and get personalized recommendations to improve your digital wellbeing.
            </p>
            <div className="hero-buttons">
              <a 
                href="https://chrome.google.com/webstore" 
                className="btn-primary btn-large"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 15.894A6.027 6.027 0 0112 18a6.027 6.027 0 01-5.894-2.106L12 12l5.894 3.894zM6.106 8.106A6.027 6.027 0 0112 6a6.027 6.027 0 015.894 2.106L12 12 6.106 8.106z"/>
                </svg>
                Add to Chrome - It's Free
              </a>
              <Link to="/signup" className="btn-secondary btn-large">
                Sign Up Now
              </Link>
            </div>
            <p className="hero-badge">
              ✨ Powered by AI • 🔒 Privacy Focused • 📊 Beautiful Analytics
            </p>
          </div>
          <div className="hero-image">
            <div className="browser-mockup">
              <div className="browser-header">
                <div className="browser-dots">
                  <span></span><span></span><span></span>
                </div>
                <div className="browser-url">scrollwise.app/dashboard</div>
              </div>
              <div className="browser-content">
                <div className="stats-demo">
                  <div className="stat-card-demo">
                    <div className="stat-icon-demo">📜</div>
                    <div>
                      <p>Scrolls</p>
                      <h3>2,847</h3>
                    </div>
                  </div>
                  <div className="stat-card-demo">
                    <div className="stat-icon-demo">👆</div>
                    <div>
                      <p>Clicks</p>
                      <h3>1,234</h3>
                    </div>
                  </div>
                </div>
                <div className="insight-demo">
                  <span className="insight-badge-demo">✨ AI Insight</span>
                  <p>You've scrolled 284m today - that's like climbing 947 stairs! 🏔️</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="container">
          <h2 className="section-title">Powerful Features</h2>
          <p className="section-subtitle">Everything you need to understand your digital life</p>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Real-Time Tracking</h3>
              <p>Monitor your scrolling, clicks, and browsing activity across all tabs in real-time.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI-Powered Insights</h3>
              <p>Get fun, personalized insights powered by advanced AI that makes data entertaining.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Beautiful Analytics</h3>
              <p>Visualize your habits with stunning charts and graphs that tell your digital story.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Privacy First</h3>
              <p>Your data stays yours. We encrypt everything and never sell your information.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Lightweight</h3>
              <p>Runs silently in the background without slowing down your browser.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Beautiful Design</h3>
              <p>Enjoy a delightful, intuitive interface inspired by Apple's design principles.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">Get started in 3 simple steps</p>
          
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Install Extension</h3>
                <p>Add ScrollWise to Chrome with one click from the Chrome Web Store.</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Create Account</h3>
                <p>Sign up with Google or email in seconds. No credit card required.</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Start Tracking</h3>
                <p>Click "Start Tracking" and browse normally. We'll do the rest!</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Insights Section */}
      <section id="insights" className="insights-section">
        <div className="container">
          <h2 className="section-title">Fun AI Insights</h2>
          <p className="section-subtitle">See your habits in a whole new way</p>
          
          <div className="insights-examples">
            <div className="insight-example">
              <span className="insight-emoji">🏃‍♂️</span>
              <p>"You've scrolled 500m today - that's like running 5 football fields!"</p>
            </div>
            
            <div className="insight-example">
              <span className="insight-emoji">⚡</span>
              <p>"Your 1,234 clicks generated enough heat to power 2 LED bulbs!"</p>
            </div>
            
            <div className="insight-example">
              <span className="insight-emoji">🎮</span>
              <p>"You switched tabs 89 times - more than a gamer switches weapons!"</p>
            </div>
            
            <div className="insight-example">
              <span className="insight-emoji">📚</span>
              <p>"You doom-scrolled for 45 minutes, enough to read 3 chapters!"</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <h2>Ready to Understand Your Habits?</h2>
          <p>Join thousands of users tracking their digital wellness</p>
          <div className="cta-buttons">
            <a 
              href="https://chrome.google.com/webstore" 
              className="btn-primary btn-large"
              target="_blank"
              rel="noopener noreferrer"
            >
              Add to Chrome - Free
            </a>
            <Link to="/signup" className="btn-secondary btn-large">
              Create Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="logo">
                <span className="logo-icon">📊</span>
                <span className="logo-text">ScrollWise</span>
              </div>
              <p>Track your digital habits with AI-powered insights</p>
            </div>
            
            <div className="footer-links">
              <div className="footer-column">
                <h4>Product</h4>
                <a href="#features">Features</a>
                <a href="#how-it-works">How It Works</a>
                <a href="#insights">Insights</a>
              </div>
              
              <div className="footer-column">
                <h4>Company</h4>
                <a href="/about">About</a>
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms</a>
              </div>
              
              <div className="footer-column">
                <h4>Support</h4>
                <a href="/help">Help Center</a>
                <a href="/contact">Contact</a>
                <a href="/faq">FAQ</a>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>© 2025 ScrollWise. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
