#!/bin/bash
set -e

echo "🚀 Starting Full-Stack Authentication App with TiDB and Kafka..."
echo "=================================================="

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p api/src/{controllers,middleware,models,routes,utils}
mkdir -p client/src/{components,context}
mkdir -p client/public
mkdir -p consumer/src
mkdir -p database
mkdir -p scripts
mkdir -p logs

# Make scripts executable
chmod +x scripts/init-db.sh
chmod +x scripts/setup-cdc.sh

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down -v 2>/dev/null || docker compose down -v 2>/dev/null || true

# Clean up old volumes if requested
read -p "🗑️  Do you want to clean up old data volumes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧹 Cleaning up old volumes..."
    docker-compose down -v --remove-orphans 2>/dev/null || docker compose down -v --remove-orphans 2>/dev/null || true
    docker volume prune -f
fi

# Pull latest images
echo "📥 Pulling latest Docker images..."
docker-compose pull 2>/dev/null || docker compose pull 2>/dev/null

# Build and start services
echo "🔨 Building and starting services..."
echo "This may take several minutes on first run..."

if command -v docker-compose &> /dev/null; then
    docker-compose up --build -d
else
    docker compose up --build -d
fi

echo ""
echo "⏳ Waiting for services to be ready..."

# Wait for services to be healthy
echo "📋 Checking service health..."

# Function to check service health
check_service_health() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose ps $service 2>/dev/null | grep -q "healthy\|Up" || docker compose ps $service 2>/dev/null | grep -q "healthy\|Up"; then
            echo "✅ $service is ready"
            return 0
        fi
        echo "⏳ Waiting for $service... (attempt $attempt/$max_attempts)"
        sleep 10
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service failed to become ready"
    return 1
}

# Check core services
echo "Checking TiDB cluster..."
check_service_health "tidb"

echo "Checking Kafka..."
check_service_health "kafka"

echo "Checking API..."
check_service_health "api"

echo "Checking Client..."
check_service_health "client"

# Show service status
echo ""
echo "📊 Service Status:"
docker-compose ps 2>/dev/null || docker compose ps 2>/dev/null

# Show logs for critical services
echo ""
echo "📝 Recent logs from key services:"
echo "--- API Logs ---"
docker-compose logs --tail=10 api 2>/dev/null || docker compose logs --tail=10 api 2>/dev/null

echo ""
echo "--- Consumer Logs ---"
docker-compose logs --tail=10 consumer 2>/dev/null || docker compose logs --tail=10 consumer 2>/dev/null

echo ""
echo "🎉 Application is starting up!"
echo "=================================================="
echo ""
echo "📱 Application URLs:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:3001"
echo "   Health:    http://localhost:3001/health"
echo ""
echo "🗄️  Database Connection:"
echo "   TiDB:      localhost:4000"
echo "   Username:  root"
echo "   Password:  (empty)"
echo "   Database:  auth_app"
echo ""
echo "📨 Message Queue:"
echo "   Kafka:     localhost:9092"
echo "   Topics:    user-activities, database-changes"
echo ""
echo "🔐 Demo Login Credentials:"
echo "   Email:     demo@example.com"
echo "   Password:  Demo123!"
echo ""
echo "   Email:     admin@example.com"
echo "   Password:  Admin123!"
echo ""
echo "📊 Monitoring:"
echo "   TiCDC:     http://localhost:8300/status"
echo "   PD:        http://localhost:2379/pd/health"
echo ""
echo "🛠️  Useful Commands:"
echo "   View logs:     docker-compose logs -f [service]"
echo "   Stop all:      docker-compose down"
echo "   Restart:       docker-compose restart [service]"
echo "   Clean reset:   docker-compose down -v && ./start.sh"
echo ""
echo "⚡ The application should be ready in 1-2 minutes."
echo "   Check the frontend at http://localhost:3000"
echo ""
echo "🔍 To see real-time CDC events:"
echo "   docker-compose logs -f consumer"
echo ""
echo "📋 To check changefeed status:"
echo "   curl http://localhost:8300/api/v1/changefeeds"
echo ""

# Wait a bit and do final health check
sleep 30

echo "🏥 Final Health Check:"
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend API is responding"
else
    echo "⚠️  Backend API is not responding yet"
fi

if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is responding"
else
    echo "⚠️  Frontend is not responding yet"
fi

if curl -s http://localhost:8300/status > /dev/null; then
    echo "✅ TiCDC is responding"
else
    echo "⚠️  TiCDC is not responding yet"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Try logging in with demo@example.com / Demo123!"
echo "3. Check the consumer logs to see CDC events: docker-compose logs -f consumer"
echo "4. Monitor the database changes in real-time"
echo ""
echo "📖 For troubleshooting, check the README.md file"
echo "=================================================="