FROM node:18-alpine

# Create app directory
WORKDIR /app

# Create logs directory
RUN mkdir -p /app/logs

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "node src/consumer.js" > /dev/null || exit 1

# Start the consumer
CMD ["npm", "start"]