# Fullstack Authentication App

This project is a fullstack authentication application that includes a **React frontend**, **Node.js API backend**, **Kafka consumer**, and **TiDB database** with **TiCDC** for change data capture.  
The system logs activity and supports monitoring via Kafka and custom logging.

## 🛠️ Project Structure

├── api/ # Node.js backend
├── client/ # React frontend
├── consumer/ # Kafka consumer
├── database/ # SQL schema & seed files
├── scripts/ # Init & CDC setup scripts
├── docker-compose.yml
└── README.md

## 🚀 How to Run

1. **Start all services**:
   ```bash
   docker-compose up -d
If needed, rebuild the API service:

docker-compose up -d --build api
Ensure all containers are healthy:

docker ps
Access the site:

Frontend: http://localhost:3000

Backend: http://localhost:3001

🧪 Technologies Used

React (Frontend)

Node.js (Backend API + Kafka consumer)

TiDB (Distributed SQL Database)

Kafka (Messaging broker)

TiCDC (Change Data Capture)

Docker & Docker Compose

log4js (Logging)

⚙️ Environment Configuration

Create a .env file in your root project directory and include the following:

# Backend API Environment Variables
NODE_ENV=production
PORT=3001

# Database Configuration
DB_HOST=tidb
DB_PORT=4000
DB_USER=root
DB_PASSWORD=
DB_NAME=auth_app
DB_SSL=false

# Kafka Configuration
KAFKA_BROKER=kafka:29092

# Security
JWT_SECRET=your-secret-jwt-key

# Logging
LOG_LEVEL=info

# Frontend Environment Variables
REACT_APP_API_URL=http://localhost:3001

# TiCDC Configuration
TICDC_ADDR=ticdc:8300
TICDC_PD_ADDR=pd:2379

# Kafka Topics
KAFKA_USER_ACTIVITIES_TOPIC=user-activities
KAFKA_DATABASE_CHANGES_TOPIC=database-changes
✅ Do not commit .env to version control — add it to .gitignore.

📁 Docker Tips

To stop all running containers and rebuild:

docker-compose down -v
docker-compose up -d --build
To check logs:

docker-compose logs -f api

📌 Notes

Database initializes automatically via db-init container

TiCDC sets up Kafka changefeeds to capture DB updates

Logs from backend and consumer are saved in /app/logs inside each container

