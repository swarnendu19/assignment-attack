# Deployment Guide

This guide covers the deployment configuration and processes for the Unified Multi-Channel Inbox application.

## 🏗️ Architecture Overview

The application is deployed using Docker containers with the following components:

- **Application**: Next.js application in a Node.js container
- **Database**: PostgreSQL 15 with persistent storage
- **Cache**: Redis for session management and real-time features
- **Reverse Proxy**: Nginx for SSL termination and load balancing
- **Monitoring**: Prometheus, Grafana, and Alertmanager stack

## 📋 Prerequisites

- Docker and Docker Compose installed
- SSL certificates (for production)
- Environment variables configured
- Domain name configured (for production)

## 🚀 Quick Start

### Development Deployment

```bash
# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f
```

### Production Deployment

```bash
# 1. Configure environment
cp .env.production.example .env.production
# Edit .env.production with your production values

# 2. Deploy using script
npm run deploy

# 3. Start monitoring (optional)
npm run monitoring:up
```

## 📁 File Structure

```
├── Dockerfile                           # Application container definition
├── docker-compose.yml                  # Development environment
├── docker-compose.prod.yml             # Production environment
├── nginx.conf                          # Nginx configuration
├── .env.production.example             # Production environment template
├── scripts/
│   ├── deploy.sh                       # Deployment script
│   └── rollback.sh                     # Rollback script
├── monitoring/
│   ├── docker-compose.monitoring.yml   # Monitoring stack
│   ├── prometheus.yml                  # Prometheus configuration
│   ├── alertmanager.yml               # Alert configuration
│   └── alert_rules.yml                # Alert rules
└── .github/workflows/
    └── ci-cd.yml                       # CI/CD pipeline
```

## 🔧 Configuration

### Environment Variables

#### Required Variables

```bash
# Database
DATABASE_URL="postgresql://username:password@host:5432/database"

# Authentication
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secure-secret"

# Integrations
TWILIO_ACCOUNT_SID="your-twilio-sid"
TWILIO_AUTH_TOKEN="your-twilio-token"
# ... other integration keys
```

#### Security Variables

```bash
# Encryption
ENCRYPTION_KEY="your-32-character-key"
JWT_SECRET="your-jwt-secret"

# SSL/TLS
SSL_CERT_PATH="/etc/nginx/ssl/cert.pem"
SSL_KEY_PATH="/etc/nginx/ssl/key.pem"
```

### SSL Configuration

1. **Obtain SSL certificates** (Let's Encrypt recommended):
   ```bash
   certbot certonly --standalone -d your-domain.com
   ```

2. **Copy certificates to ssl directory**:
   ```bash
   mkdir -p ssl
   cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
   cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem
   ```

## 🚢 Deployment Process

### Automated Deployment

The deployment script (`scripts/deploy.sh`) handles:

1. **Pre-deployment checks**
2. **Database backup creation**
3. **Image building and pulling**
4. **Database migrations**
5. **Zero-downtime deployment**
6. **Health checks**
7. **Cleanup**

```bash
# Deploy to production
npm run deploy

# Check deployment status
docker-compose -f docker-compose.prod.yml ps
```

### Manual Deployment Steps

1. **Build the application**:
   ```bash
   docker build -t unified-multi-channel-inbox .
   ```

2. **Run database migrations**:
   ```bash
   docker-compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
   ```

3. **Start services**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Verify deployment**:
   ```bash
   curl -f http://localhost:3000/api/health
   ```

## 🔄 Rollback Process

### Automated Rollback

```bash
# Rollback to previous image
npm run rollback image

# Rollback database from backup
npm run rollback database backups/backup-20231201-120000.sql

# Full rollback (image + database)
npm run rollback full backups/backup-20231201-120000.sql
```

### Manual Rollback

1. **Stop current containers**:
   ```bash
   docker-compose -f docker-compose.prod.yml down
   ```

2. **Restore database** (if needed):
   ```bash
   docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres unified_inbox < backup.sql
   ```

3. **Start previous version**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## 📊 Monitoring

### Monitoring Stack

The monitoring stack includes:

- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboards
- **Alertmanager**: Alert management
- **Node Exporter**: System metrics
- **cAdvisor**: Container metrics

### Starting Monitoring

```bash
# Start monitoring stack
npm run monitoring:up

# Access dashboards
# Grafana: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
# Alertmanager: http://localhost:9093
```

### Key Metrics

- **Application Health**: `/api/health`
- **Metrics Endpoint**: `/api/metrics`
- **Response Times**: HTTP request durations
- **Error Rates**: 4xx/5xx response rates
- **Business Metrics**: Messages, contacts, conversations

### Alerts

Configured alerts include:

- **System**: High CPU, memory, disk usage
- **Application**: High response times, error rates
- **Infrastructure**: Database/Redis down
- **Business**: Webhook failures, delivery failures

## 🔒 Security

### Security Measures

1. **SSL/TLS encryption** for all communications
2. **Rate limiting** on API endpoints
3. **Webhook signature validation**
4. **Environment variable encryption**
5. **Regular security updates**

### Security Headers

Nginx is configured with security headers:

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security`

## 🔧 Maintenance

### Regular Tasks

1. **Database backups** (automated daily)
2. **Log rotation** (configured in Docker)
3. **Security updates** (automated via CI/CD)
4. **Certificate renewal** (Let's Encrypt auto-renewal)

### Backup Management

```bash
# Manual backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres unified_inbox > backup.sql

# List backups
ls -la backups/

# Cleanup old backups (automated in deploy script)
find backups/ -name "backup-*.sql" -mtime +30 -delete
```

### Log Management

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f app

# View all service logs
docker-compose -f docker-compose.prod.yml logs -f

# Log rotation is handled by Docker daemon
```

## 🚨 Troubleshooting

### Common Issues

1. **Health check failures**:
   ```bash
   # Check application logs
   docker-compose -f docker-compose.prod.yml logs app
   
   # Check database connectivity
   docker-compose -f docker-compose.prod.yml exec app npx prisma db push
   ```

2. **SSL certificate issues**:
   ```bash
   # Verify certificate files
   ls -la ssl/
   
   # Test SSL configuration
   openssl s_client -connect your-domain.com:443
   ```

3. **Database connection issues**:
   ```bash
   # Check database status
   docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres
   
   # Check connection string
   echo $DATABASE_URL
   ```

### Performance Issues

1. **High memory usage**:
   - Check container resource limits
   - Review application memory leaks
   - Scale horizontally if needed

2. **Slow response times**:
   - Check database query performance
   - Review Redis cache hit rates
   - Analyze Nginx access logs

### Recovery Procedures

1. **Complete system failure**:
   ```bash
   # Stop all services
   docker-compose -f docker-compose.prod.yml down
   
   # Restore from backup
   npm run rollback full backups/latest-backup.sql
   ```

2. **Data corruption**:
   ```bash
   # Restore database from backup
   npm run rollback database backups/backup-before-corruption.sql
   ```

## 📞 Support

For deployment issues:

1. Check the logs first
2. Review this documentation
3. Check monitoring dashboards
4. Contact the development team

## 🔄 CI/CD Pipeline

The GitHub Actions pipeline automatically:

1. **Tests** code on pull requests
2. **Builds** Docker images on main branch
3. **Deploys** to staging/production
4. **Runs** health checks post-deployment
5. **Sends** notifications on failures

### Pipeline Configuration

See `.github/workflows/ci-cd.yml` for the complete pipeline configuration.

### Required Secrets

Configure these secrets in your GitHub repository:

- `PRODUCTION_URL`: Your production domain
- `SNYK_TOKEN`: Snyk security scanning token
- Deployment credentials (if using cloud providers)