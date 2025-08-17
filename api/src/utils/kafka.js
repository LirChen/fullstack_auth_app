const { Kafka } = require('kafkajs');
const log4js = require('log4js');

const logger = log4js.getLogger('kafka');

const kafka = new Kafka({
  clientId: 'auth-app',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 8,
    maxRetryTime: 30000,
    factor: 0.2,
    multiplier: 2,
    restartOnFailure: async (e) => {
      logger.error('Kafka connection failed, restarting...', e);
      return true;
    }
  }
});

let producer = null;
let admin = null;

async function setupKafka() {
  try {
    // Create Kafka admin client
    admin = kafka.admin();
    await admin.connect();

    // Create topics if they don't exist
    const topics = [
      {
        topic: 'database-changes',
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          {
            name: 'cleanup.policy',
            value: 'compact'
          }
        ]
      },
      {
        topic: 'user-activities',
        numPartitions: 3,
        replicationFactor: 1
      }
    ];

    const existingTopics = await admin.listTopics();
    const topicsToCreate = topics.filter(topic => !existingTopics.includes(topic.topic));

    if (topicsToCreate.length > 0) {
      await admin.createTopics({
        topics: topicsToCreate
      });
      logger.info('Created Kafka topics:', topicsToCreate.map(t => t.topic));
    }

    // Setup producer
    producer = kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });
    
    await producer.connect();
    logger.info('Kafka setup completed successfully');

    return { kafka, producer, admin };
  } catch (error) {
    logger.error('Kafka setup failed:', error);
    throw error;
  }
}

async function sendUserActivity(activityData) {
  try {
    if (!producer) {
      logger.warn('Kafka producer not initialized');
      return;
    }

    await producer.send({
      topic: 'user-activities',
      messages: [{
        key: `user-${activityData.userId}-${Date.now()}`,
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          ...activityData
        }),
        headers: {
          'event-type': 'user-activity',
          'app-version': '1.0.0'
        }
      }]
    });

    logger.debug('User activity sent to Kafka:', activityData.action);
  } catch (error) {
    logger.error('Failed to send user activity to Kafka:', error);
  }
}

async function sendDatabaseChange(changeData) {
  try {
    if (!producer) {
      logger.warn('Kafka producer not initialized');
      return;
    }

    await producer.send({
      topic: 'database-changes',
      messages: [{
        key: `${changeData.table}-${Date.now()}`,
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          ...changeData
        }),
        headers: {
          'event-type': 'database-change',
          'table': changeData.table
        }
      }]
    });

    logger.debug('Database change sent to Kafka:', changeData.operation);
  } catch (error) {
    logger.error('Failed to send database change to Kafka:', error);
  }
}

// Graceful shutdown
async function disconnect() {
  try {
    if (producer) {
      await producer.disconnect();
      logger.info('Kafka producer disconnected');
    }
    if (admin) {
      await admin.disconnect();
      logger.info('Kafka admin disconnected');
    }
  } catch (error) {
    logger.error('Error disconnecting from Kafka:', error);
  }
}

process.on('SIGTERM', disconnect);
process.on('SIGINT', disconnect);

module.exports = {
  kafka,
  setupKafka,
  sendUserActivity,
  sendDatabaseChange,
  disconnect
};