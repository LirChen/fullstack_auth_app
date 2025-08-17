import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, error, setError } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    if (error) {
      setError('');
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setIsSubmitting(true);
    setFormErrors({});
    
    try {
      const result = await login(formData.email, formData.password);
      
      if (!result.success) {
        // Error is handled by the auth context
        console.error('Login failed:', result.error);
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Login</h2>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={formErrors.email ? 'error' : ''}
              required
            />
            {formErrors.email && (
              <span className="field-error">{formErrors.email}</span>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={formErrors.password ? 'error' : ''}
              required
            />
            {formErrors.password && (
              <span className="field-error">{formErrors.password}</span>
            )}
          </div>
          
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="submit-btn"
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="auth-links">
          <p>
            Don't have an account? <Link to="/register">Register here</Link>
          </p>
        </div>
        
        {/* Demo credentials for testing */}
        <div className="demo-info">
          <h4>Demo Credentials:</h4>
          <p>Email: demo@example.com</p>
          <p>Password: Demo123!</p>
          <small>These will be created when the database initializes</small>
        </div>
      </div>
    </div>
  );
}

export default Login;