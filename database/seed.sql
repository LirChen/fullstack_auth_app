USE auth_app;

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('app_name', 'Full-Stack Auth App', 'Application name'),
('app_version', '1.0.0', 'Application version'),
('max_login_attempts', '5', 'Maximum login attempts before lockout'),
('session_timeout', '86400', 'Session timeout in seconds (24 hours)'),
('token_expiry', '86400', 'JWT token expiry in seconds (24 hours)'),
('enable_audit_logs', 'true', 'Enable audit logging'),
('maintenance_mode', 'false', 'Maintenance mode flag')
ON DUPLICATE KEY UPDATE 
setting_value = VALUES(setting_value),
description = VALUES(description);

-- Create default demo user
-- Password is 'Demo123!' (hashed with bcrypt, cost factor 12)
INSERT INTO users (username, email, password_hash, created_at) VALUES
(
    'demo_user', 
    'demo@example.com', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LwVnoyNcSmMQrNIAe',
    NOW()
)
ON DUPLICATE KEY UPDATE 
password_hash = VALUES(password_hash),
last_login = NULL;

-- Create admin user
-- Password is 'Admin123!' (hashed with bcrypt, cost factor 12)
INSERT INTO users (username, email, password_hash, created_at) VALUES
(
    'admin', 
    'admin@example.com', 
    '$2b$12$9K8mKQpVSUCAjS6rGb02.eN5C1mKGY8ZfGh6JtKbLV5UxLhbr5Huy',
    NOW()
)
ON DUPLICATE KEY UPDATE 
password_hash = VALUES(password_hash),
last_login = NULL;

-- Create test user
-- Password is 'Test123!' (hashed with bcrypt, cost factor 12)
INSERT INTO users (username, email, password_hash, created_at) VALUES
(
    'testuser', 
    'test@example.com', 
    '$2b$12$rG8x4Qr1MnJ7Lm8JB9v5WerQZ5cJ3DpVY2KwH7vV8QJ1mF5mR6N8S',
    NOW()
)
ON DUPLICATE KEY UPDATE 
password_hash = VALUES(password_hash),
last_login = NULL;

-- Insert sample audit log entries
INSERT INTO audit_logs (user_id, action, resource_type, ip_address, details, created_at) VALUES
(1, 'USER_CREATED', 'user', '127.0.0.1', '{"method": "seed_script"}', NOW() - INTERVAL 1 DAY),
(2, 'USER_CREATED', 'user', '127.0.0.1', '{"method": "seed_script"}', NOW() - INTERVAL 1 DAY),
(3, 'USER_CREATED', 'user', '127.0.0.1', '{"method": "seed_script"}', NOW() - INTERVAL 1 DAY);

-- Clean up expired tokens (maintenance)
DELETE FROM user_tokens WHERE expires_at < NOW();

-- Clean up old audit logs (keep last 30 days)
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL 30 DAY;

-- Show created users
SELECT 
    id,
    username,
    email,
    created_at,
    'Demo123!' as demo_password,
    CASE 
        WHEN username = 'demo_user' THEN 'Use this for testing login'
        WHEN username = 'admin' THEN 'Admin123!'
        WHEN username = 'testuser' THEN 'Test123!'
    END as password_info
FROM users 
WHERE username IN ('demo_user', 'admin', 'testuser')
ORDER BY id;