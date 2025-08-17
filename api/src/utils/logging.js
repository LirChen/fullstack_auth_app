const fs = require('fs');
const log4js = require('log4js');

function ensureLogDir() {
  try { fs.mkdirSync('/app/logs', { recursive: true }); } catch (_) {}
}

function setupLogging() {
  ensureLogDir();

  log4js.configure({
    appenders: {
      console: {
        type: 'console',
        layout: { type: 'pattern', pattern: '%d{yyyy-MM-dd hh:mm:ss.SSS} [%p] %c - %m' }
      },
      file: {
        type: 'file',
        filename: '/app/logs/app.log',
        maxLogSize: 10 * 1024 * 1024, // 10MB
        backups: 3,
        compress: true,
        layout: { type: 'pattern', pattern: '%m' } // היה json -> גורם לשגיאה
      },
      userActivity: {
        type: 'file',
        filename: '/app/logs/user-activity.log',
        maxLogSize: 10 * 1024 * 1024,
        backups: 5,
        compress: true,
        layout: { type: 'pattern', pattern: '%m' } // JSON עובר כמחרוזת
      },
      databaseChanges: {
        type: 'file',
        filename: '/app/logs/database-changes.log',
        maxLogSize: 10 * 1024 * 1024,
        backups: 5,
        compress: true,
        layout: { type: 'pattern', pattern: '%m' }
      }
    },
    categories: {
      default: { appenders: ['console', 'file'], level: process.env.LOG_LEVEL || 'info' },
      server:  { appenders: ['console', 'file'], level: 'info' },
      database:{ appenders: ['console', 'file', 'databaseChanges'], level: 'debug' },
      userActivity: { appenders: ['console', 'userActivity'], level: 'info' },
      kafka:   { appenders: ['console', 'file'], level: 'info' }
    }
  });
}

// Custom logger for user activities
function logUserActivity(userId, action, ipAddress, additionalData = {}) {
  const activityLogger = log4js.getLogger('userActivity');
  const activityLog = {
    timestamp: new Date().toISOString(),
    userId,
    action,
    ipAddress,
    userAgent: additionalData.userAgent ?? null,
    sessionId: additionalData.sessionId ?? null,
    success: additionalData.success ?? true,
    errorMessage: additionalData.errorMessage ?? null,
    duration: additionalData.duration ?? null
  };
  activityLogger.info(JSON.stringify(activityLog));
  return activityLog;
}

// Custom logger for database changes
function logDatabaseChange(table, operation, affectedRows, queryDetails = {}) {
  const dbLogger = log4js.getLogger('database');
  const changeLog = {
    timestamp: new Date().toISOString(),
    table,
    operation: String(operation).toUpperCase(),
    affectedRows,
    duration: queryDetails.duration ?? null,
    query: queryDetails.query
      ? queryDetails.query.substring(0, 200) + (queryDetails.query.length > 200 ? '...' : '')
      : null,
    userId: queryDetails.userId ?? null
  };
  dbLogger.info(JSON.stringify(changeLog));
  return changeLog;
}

module.exports = { setupLogging, logUserActivity, logDatabaseChange };
