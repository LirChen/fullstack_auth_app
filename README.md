# 🔐 Fullstack Authentication App

A production-ready authentication system with **React**, **Node.js/Express**, **Kafka**, **TiDB**, and **TiCDC**.

## ✨ Key Features

- JWT authentication with refresh tokens
- Secure password hashing (bcrypt)
- Real-time change data capture (TiCDC)
- Event streaming with Kafka
- Swagger API documentation
- Docker-based deployment

## 🚀 Quick Start

### Prerequisites
- Docker (20.10+)
- Docker Compose (2.0+)
- 8GB RAM minimum

### Run the Application

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd fullstack_auth_app

# 2. Create environment file
cp .env.example .env

# 3. Start all services
docker-compose up -d

# 4. Wait 1-2 minutes for initialization
docker-compose ps
```

### Access Points
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **API Docs:** http://localhost:3001/api-docs
- **Health Check:** http://localhost:3001/health

### Demo Credentials

| Email | Password | Role |
|-------|----------|------|
| demo@example.com | Demo123! | User |
| admin@example.com | Admin123! | Admin |
| test@example.com | Test123! | User |

## 📡 API Endpoints

### Authentication
```bash
# Register
POST /api/auth/register
Body: { "username", "email", "password" }

# Login
POST /api/auth/login
Body: { "email", "password" }

# Refresh Token
POST /api/auth/refresh
Body: { "refreshToken" }

# Logout
POST /api/auth/logout
Headers: Authorization Bearer <token>

# Validate Token
GET /api/auth/validate
Headers: Authorization Bearer <token>
```

### Users
```bash
# Get All Users
GET /api/users
Headers: Authorization Bearer <token>

# Get User by ID
GET /api/users/:id
Headers: Authorization Bearer <token>
```

📚 **Full documentation:** http://localhost:3001/api-docs

## 🏗️ Project Structure

```
├── api/                   # Node.js backend + Swagger
├── client/                # React frontend
├── consumer/              # Kafka consumer
├── database/              # SQL schema & seed data
├── scripts/               # Initialization scripts
├── docker-compose.yml     # Service orchestration
├── .env.example           # Configuration template
└── README.md
```

## ⚙️ Configuration

Create a `.env` file with these key variables:

```env
# Security (⚠️ CHANGE IN PRODUCTION)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d

# Database
DB_HOST=tidb
DB_PORT=4000
DB_NAME=auth_app

# API
PORT=3001
CLIENT_URL=http://localhost:3000

# Kafka
KAFKA_BROKER=kafka:29092
```

See `.env.example` for all available options.

## 🛠️ Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React, React Router, Context API |
| Backend | Node.js, Express, JWT, bcrypt |
| Database | TiDB, TiKV, PD |
| Messaging | Kafka, Zookeeper |
| CDC | TiCDC |
| Docs | Swagger/OpenAPI |
| Logging | log4js |

## 🐳 Useful Commands

```bash
# Start services in background
docker-compose up -d

# Rebuild and start
docker-compose up -d --build

# Stop services
docker-compose down

# Stop and remove all data (⚠️ destructive)
docker-compose down -v

# View logs
docker-compose logs -f
docker-compose logs -f api        # specific service

# Check service status
docker-compose ps
```

## 🔒 Security Notes

**For production deployment:**

1. Generate strong JWT secret:
   ```bash
   openssl rand -base64 64
   ```

2. Set database password in `.env`

3. Enable HTTPS with reverse proxy (nginx/Traefik)

4. Update `CLIENT_URL` to your production domain

5. Set `LOG_LEVEL=warn` or `error`

6. Keep dependencies updated regularly

## 🔧 Troubleshooting

**Services won't start?**
```bash
docker-compose down -v
docker-compose up --build
```

**Database connection errors?**
- Wait 30-60 seconds for TiDB initialization
- Check logs: `docker-compose logs -f tidb`

**Frontend can't connect to backend?**
- Verify `REACT_APP_API_URL` in `.env`
- Test API: http://localhost:3001/health

**Out of memory?**
- Increase Docker memory to 8GB+ in Docker Desktop settings

## 📝 Notes

- Database auto-initializes via `db-init` container
- TiCDC automatically sets up Kafka changefeeds
- Logs are stored in `/app/logs` inside containers
- Rate limiting: 100 requests/15min (general), 10 requests/min (auth)

## 📄 License

MIT License

---

**Built with ❤️ for production readiness**