const { Kafka } = require('kafkajs');
const log4js = require('log4js');
require('dotenv').config();

// Setup logging - Fixed configuration
log4js.configure({
  appenders: {
    console: {
      type: 'console',
      layout: {
        type: 'pattern',
        pattern: '%d{yyyy-MM-dd hh:mm:ss.SSS} [%p] %c - %m'
      }
    },
    file: {
      type: 'file',
      filename: '/app/logs/consumer.log',
      maxLogSize: 10485760,
      backups: 3,
      layout: {
        type: 'pattern',
        pattern: '%d{yyyy-MM-dd hh:mm:ss.SSS} [%p] %c - %m'
      }
    },
    cdcEvents: {
      type: 'file',
      filename: '/app/logs/cdc-events.log',
      maxLogSize: 10485760,
      backups: 5,
      layout: {
        type: 'pattern',
        pattern: '%d{yyyy-MM-dd hh:mm:ss.SSS} [%p] %c - %m'
      }
    }
  },
  categories: {
    default: {
      appenders: ['console', 'file'],
      level: process.env.LOG_LEVEL || 'info'
    },
    consumer: {
      appenders: ['console', 'file'],
      level: 'info'
    },
    cdc: {
      appenders: ['console', 'cdcEvents'],
      level: 'info'
    }
  }
});

const logger = log4js.getLogger('consumer');
const cdcLogger = log4js.getLogger('cdc');

// Kafka configuration
const kafka = new Kafka({
  clientId: 'cdc-consumer',
  brokers: [process.env.KAFKA_BROKER || 'kafka:29092'],
  retry: {
    initialRetryTime: 100,
    retries: 8,
    maxRetryTime: 30000,
    factor: 0.2,
    multiplier: 2
  }
});

const consumer = kafka.consumer({ 
  groupId: 'cdc-processor-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

// Message processing functions
function processUserActivity(message) {
  try {
    const activity = JSON.parse(message.value.toString());
    
    const processedActivity = {
      timestamp: new Date().toISOString(),
      eventType: 'USER_ACTIVITY',
      originalTimestamp: activity.timestamp,
      userId: activity.userId,
      action: activity.action,
      ipAddress: activity.ipAddress,
      userAgent: activity.userAgent,
      success: activity.success,
      duration: activity.duration,
      sessionId: activity.sessionId || null,
      processingDelay: calculateDelay(activity.timestamp)
    };

    // Log to console in structured format
    console.log(JSON.stringify(processedActivity));
    
    // Log to file
    cdcLogger.info(JSON.stringify(processedActivity));
    
    return processedActivity;
  } catch (error) {
    logger.error('Error processing user activity:', error);
    throw error;
  }
}

function processDatabaseChange(message) {
  try {
    const change = JSON.parse(message.value.toString());
    
    const processedChange = {
      timestamp: new Date().toISOString(),
      eventType: 'DATABASE_CHANGE',
      originalTimestamp: change.timestamp,
      table: change.table,
      operation: change.operation,
      affectedRows: change.affectedRows,
      duration: change.duration,
      query: change.query ? change.query.substring(0, 100) + '...' : null,
      processingDelay: calculateDelay(change.timestamp),
      changeId: `${change.table}-${change.operation}-${Date.now()}`
    };

    // Log to console in structured format
    console.log(JSON.stringify(processedChange));
    
    // Log to file
    cdcLogger.info(JSON.stringify(processedChange));
    
    // Additional processing based on table and operation
    if (change.table === 'users') {
      processUserTableChange(processedChange);
    } else if (change.table === 'user_tokens') {
      processTokenTableChange(processedChange);
    }
    
    return processedChange;
  } catch (error) {
    logger.error('Error processing database change:', error);
    throw error;
  }
}

function processUserTableChange(change) {
  const userChangeLog = {
    timestamp: new Date().toISOString(),
    eventType: 'USER_TABLE_CHANGE',
    operation: change.operation,
    affectedRows: change.affectedRows,
    alert: change.operation === 'DELETE' ? 'USER_DELETION_DETECTED' : null,
    metadata: {
      table: change.table,
      originalTimestamp: change.originalTimestamp
    }
  };
  
  console.log(JSON.stringify(userChangeLog));
  cdcLogger.info(JSON.stringify(userChangeLog));
}

function processTokenTableChange(change) {
  const tokenChangeLog = {
    timestamp: new Date().toISOString(),
    eventType: 'TOKEN_TABLE_CHANGE',
    operation: change.operation,
    affectedRows: change.affectedRows,
    alert: change.operation === 'INSERT' ? 'NEW_TOKEN_CREATED' : 
           change.operation === 'UPDATE' ? 'TOKEN_UPDATED' : 
           'TOKEN_DELETED',
    metadata: {
      table: change.table,
      originalTimestamp: change.originalTimestamp
    }
  };
  
  console.log(JSON.stringify(tokenChangeLog));
  cdcLogger.info(JSON.stringify(tokenChangeLog));
}

function calculateDelay(originalTimestamp) {
  const original = new Date(originalTimestamp);
  const now = new Date();
  return `${now.getTime() - original.getTime()}ms`;
}

// Message processing statistics
let messageStats = {
  userActivities: 0,
  databaseChanges: 0,
  totalProcessed: 0,
  errors: 0,
  startTime: new Date()
};

function updateStats(messageType, success = true) {
  if (success) {
    messageStats.totalProcessed++;
    if (messageType === 'user-activity') {
      messageStats.userActivities++;
    } else if (messageType === 'database-change') {
      messageStats.databaseChanges++;
    }
  } else {
    messageStats.errors++;
  }
}

function logStats() {
  const uptime = Date.now() - messageStats.startTime.getTime();
  const statsLog = {
    timestamp: new Date().toISOString(),
    eventType: 'CONSUMER_STATS',
    uptime: `${Math.floor(uptime / 1000)}s`,
    totalProcessed: messageStats.totalProcessed,
    userActivities: messageStats.userActivities,
    databaseChanges: messageStats.databaseChanges,
    errors: messageStats.errors,
    messagesPerSecond: (messageStats.totalProcessed / (uptime / 1000)).toFixed(2)
  };
  
  console.log(JSON.stringify(statsLog));
  logger.info(JSON.stringify(statsLog));
}

// Main consumer function
async function runConsumer() {
  try {
    await consumer.connect();
    logger.info('Kafka consumer connected successfully');

    // Subscribe to topics
    await consumer.subscribe({ 
      topics: ['user-activities', 'database-changes'],
      fromBeginning: false 
    });

    logger.info('Subscribed to topics: user-activities, database-changes');

    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const startTime = Date.now();
        
        try {
          logger.debug(`Processing message from topic: ${topic}, partition: ${partition}`);
          
          let processedMessage;
          
          if (topic === 'user-activities') {
            processedMessage = processUserActivity(message);
            updateStats('user-activity', true);
          } else if (topic === 'database-changes') {
            processedMessage = processDatabaseChange(message);
            updateStats('database-change', true);
          } else {
            logger.warn(`Unknown topic: ${topic}`);
            return;
          }
          
          const processingTime = Date.now() - startTime;
          logger.debug(`Message processed in ${processingTime}ms`);
          
        } catch (error) {
          updateStats(topic, false);
          logger.error({
            timestamp: new Date().toISOString(),
            error: 'Message processing failed',
            topic: topic,
            partition: partition,
            offset: message.offset,
            details: error.message
          });
        }
      }
    });

  } catch (error) {
    logger.error('Consumer failed:', error);
    throw error;
  }
}

// Periodic stats logging
setInterval(logStats, 30000);  

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down consumer...');
  logStats(); 
  
  try {
    await consumer.disconnect();
    logger.info('Consumer disconnected successfully');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  shutdown();
});

// Start the consumer
logger.info({
  timestamp: new Date().toISOString(),
  message: 'Starting CDC Consumer',
  kafkaBroker: process.env.KAFKA_BROKER || 'kafka:29092',
  groupId: 'cdc-processor-group'
});

runConsumer().catch(error => {
  logger.error('Failed to start consumer:', error);
  process.exit(1);
});