#!/bin/sh
set -e

echo "Starting CDC setup..."

# Wait for TiCDC to be ready
echo "Waiting for TiCDC to be ready..."
while ! curl -f http://ticdc:8300/status > /dev/null 2>&1; do
    echo "TiCDC is not ready yet. Waiting..."
    sleep 10
done

echo "TiCDC is ready. Setting up CDC changefeed..."

# Wait a bit more to ensure everything is stable
sleep 15

# Create CDC changefeed for Kafka
echo "Creating CDC changefeed..."
curl -X POST http://ticdc:8300/api/v1/changefeeds \
  -H "Content-Type: application/json" \
  -d '{
    "changefeed_id": "auth-app-cdc",
    "sink_uri": "kafka://kafka:29092/database-changes?protocol=canal-json&partition-num=3"
    "rules": [
      "auth_app.users",
      "auth_app.user_tokens",
      "auth_app.user_sessions",
      "auth_app.audit_logs"
    ],
    "config": {
      "filter": {
        "rules": [
          "auth_app.users",
          "auth_app.user_tokens", 
          "auth_app.user_sessions",
          "auth_app.audit_logs"
        ]
      },
      "sink": {
        "dispatchers": [
          {
            "matcher": ["auth_app.users"],
            "dispatcher": "ts"
          },
          {
            "matcher": ["auth_app.user_tokens"],
            "dispatcher": "rowid"
          }
        ]
      },
      "cyclic-replication": {
        "enable": false
      }
    }
  }'

echo ""
echo "Checking changefeed status..."
sleep 5

# Check changefeed status
CHANGEFEED_STATUS=$(curl -s http://ticdc:8300/api/v1/changefeeds/auth-app-cdc | grep -o '"state":"[^"]*"' | cut -d'"' -f4)

if [ "$CHANGEFEED_STATUS" = "normal" ] || [ "$CHANGEFEED_STATUS" = "running" ]; then
    echo "CDC changefeed created successfully and is running!"
else
    echo "CDC changefeed status: $CHANGEFEED_STATUS"
    echo "Attempting to start changefeed..."
    
    # Try to resume if stopped
    curl -X POST http://ticdc:8300/api/v1/changefeeds/auth-app-cdc/resume
    sleep 3
    
    CHANGEFEED_STATUS=$(curl -s http://ticdc:8300/api/v1/changefeeds/auth-app-cdc | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
    echo "Final changefeed status: $CHANGEFEED_STATUS"
fi

# List all changefeeds
echo "Active changefeeds:"
curl -s http://ticdc:8300/api/v1/changefeeds | jq '.' 2>/dev/null || curl -s http://ticdc:8300/api/v1/changefeeds

echo "CDC setup completed!"

# Keep container running briefly
sleep 2