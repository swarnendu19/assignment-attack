#!/bin/bash

# Production Deployment Script
set -e

echo "🚀 Starting production deployment..."

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy-$(date +%Y%m%d-%H%M%S).log"

# Create necessary directories
mkdir -p logs backups

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to handle errors
handle_error() {
    log "❌ Error occurred during deployment: $1"
    log "🔄 Rolling back to previous version..."
    docker-compose -f "$COMPOSE_FILE" down
    docker-compose -f "$COMPOSE_FILE" up -d --no-deps app
    exit 1
}

# Trap errors
trap 'handle_error "Unexpected error"' ERR

log "📋 Pre-deployment checks..."

# Check if required files exist
if [ ! -f "$ENV_FILE" ]; then
    log "❌ Environment file $ENV_FILE not found"
    exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
    log "❌ Docker compose file $COMPOSE_FILE not found"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log "❌ Docker is not running"
    exit 1
fi

log "✅ Pre-deployment checks passed"

# Create database backup
log "💾 Creating database backup..."
BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql"
docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U postgres unified_inbox > "$BACKUP_FILE" || true
log "✅ Database backup created: $BACKUP_FILE"

# Pull latest images
log "📥 Pulling latest Docker images..."
docker-compose -f "$COMPOSE_FILE" pull

# Build new application image
log "🔨 Building application image..."
docker-compose -f "$COMPOSE_FILE" build app

# Run database migrations
log "🗄️ Running database migrations..."
docker-compose -f "$COMPOSE_FILE" run --rm app npx prisma migrate deploy

# Start services with zero-downtime deployment
log "🔄 Deploying new version..."

# Start new containers
docker-compose -f "$COMPOSE_FILE" up -d --no-deps postgres redis nginx

# Wait for database to be ready
log "⏳ Waiting for database to be ready..."
timeout=60
while ! docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        handle_error "Database failed to start within timeout"
    fi
done

# Deploy application
docker-compose -f "$COMPOSE_FILE" up -d --no-deps app

# Wait for application to be healthy
log "🏥 Waiting for application health check..."
timeout=120
while ! curl -f http://localhost:3000/api/health > /dev/null 2>&1; do
    sleep 5
    timeout=$((timeout - 5))
    if [ $timeout -le 0 ]; then
        handle_error "Application failed health check within timeout"
    fi
done

# Clean up old images
log "🧹 Cleaning up old Docker images..."
docker image prune -f

# Verify deployment
log "✅ Verifying deployment..."
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    log "✅ Deployment successful!"
    log "🌐 Application is running at http://localhost:3000"
else
    handle_error "Health check failed after deployment"
fi

# Clean up old backups (keep last 30 days)
log "🧹 Cleaning up old backups..."
find "$BACKUP_DIR" -name "backup-*.sql" -mtime +30 -delete || true

log "🎉 Deployment completed successfully!"
log "📊 Deployment summary:"
log "   - Backup created: $BACKUP_FILE"
log "   - Log file: $LOG_FILE"
log "   - Health check: ✅ Passed"