const mysql = require('mysql2/promise');
const log4js = require('log4js');
const { kafka } = require('./kafka');

const logger = log4js.getLogger('database');

let db = null;
let producer = null;

const dbConfig = {
  host: process.env.DB_HOST || 'tidb',
  port: process.env.DB_PORT || 4000,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'auth_app',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

async function setupDatabase() {
  try {
    // Create connection pool
    db = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection
    await db.execute('SELECT 1');
    
    // Setup Kafka producer for CDC
    producer = kafka.producer();
    await producer.connect();
    
    logger.info('Database and Kafka producer connected successfully');
    
    return db;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

// Enhanced query function with CDC logging
async function query(sql, params = []) {
  try {
    const startTime = Date.now();
    const [results] = await db.execute(sql, params);
    const duration = Date.now() - startTime;
    
    // Log query execution
    logger.debug({
      timestamp: new Date().toISOString(),
      sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      affectedRows: results.affectedRows || results.length
    });
    
    // Send CDC event to Kafka for DML operations
    if (sql.toLowerCase().includes('insert') || 
        sql.toLowerCase().includes('update') || 
        sql.toLowerCase().includes('delete')) {
      
      const cdcEvent = {
        timestamp: new Date().toISOString(),
        operation: sql.toLowerCase().includes('insert') ? 'INSERT' :
                  sql.toLowerCase().includes('update') ? 'UPDATE' : 'DELETE',
        table: extractTableName(sql),
        affectedRows: results.affectedRows || 0,
        query: sql,
        duration: `${duration}ms`
      };
      
      try {
        await producer.send({
          topic: 'database-changes',
          messages: [{
            key: `${cdcEvent.table}-${Date.now()}`,
            value: JSON.stringify(cdcEvent)
          }]
        });
      } catch (kafkaError) {
        logger.error('Failed to send CDC event to Kafka:', kafkaError);
      }
    }
    
    return results;
  } catch (error) {
    logger.error({
      timestamp: new Date().toISOString(),
      error: 'Database query failed',
      sql: sql,
      params: params,
      details: error.message
    });
    throw error;
  }
}

// Extract table name from SQL query
function extractTableName(sql) {
  const insertMatch = sql.match(/INSERT INTO\s+`?(\w+)`?/i);
  const updateMatch = sql.match(/UPDATE\s+`?(\w+)`?/i);
  const deleteMatch = sql.match(/DELETE FROM\s+`?(\w+)`?/i);
  
  return (insertMatch || updateMatch || deleteMatch)?.[1] || 'unknown';
}

// User-related database operations
const User = {
  async create(userData) {
    const { username, email, password_hash } = userData;
    const sql = 'INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, NOW())';
    const result = await query(sql, [username, email, password_hash]);
    return result.insertId;
  },

  async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ?';
    const results = await query(sql, [email]);
    return results[0] || null;
  },

  async findByUsername(username) {
    const sql = 'SELECT * FROM users WHERE username = ?';
    const results = await query(sql, [username]);
    return results[0] || null;
  },

  async findById(id) {
    const sql = 'SELECT id, username, email, created_at, last_login FROM users WHERE id = ?';
    const results = await query(sql, [id]);
    return results[0] || null;
  },

  async updateLastLogin(userId, ipAddress) {
    const sql = 'UPDATE users SET last_login = NOW(), last_ip = ? WHERE id = ?';
    await query(sql, [ipAddress, userId]);
  }
};

// Token-related database operations
const Token = {
  async create(userId, token, expiresAt) {
    const sql = 'INSERT INTO user_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, NOW())';
    await query(sql, [userId, token, expiresAt]);
  },

  async findValid(token) {
    const sql = `
      SELECT ut.*, u.username, u.email 
      FROM user_tokens ut 
      JOIN users u ON ut.user_id = u.id 
      WHERE ut.token = ? AND ut.expires_at > NOW() AND ut.is_active = 1
    `;
    const results = await query(sql, [token]);
    return results[0] || null;
  },

  async invalidate(token) {
    const sql = 'UPDATE user_tokens SET is_active = 0 WHERE token = ?';
    await query(sql, [token]);
  },

  async cleanup() {
    const sql = 'DELETE FROM user_tokens WHERE expires_at < NOW()';
    await query(sql);
  }
};

module.exports = {
  setupDatabase,
  query,
  User,
  Token,
  getConnection: () => db
};