#!/bin/bash

# Production Rollback Script
set -e

echo "🔄 Starting rollback process..."

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="./backups"
LOG_FILE="./logs/rollback-$(date +%Y%m%d-%H%M%S).log"

# Create logs directory
mkdir -p logs

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to list available backups
list_backups() {
    log "📋 Available backups:"
    ls -la "$BACKUP_DIR"/backup-*.sql 2>/dev/null | tail -10 || log "No backups found"
}

# Function to rollback to previous image
rollback_image() {
    log "🔄 Rolling back to previous Docker image..."
    
    # Get previous image
    PREVIOUS_IMAGE=$(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | grep unified-multi-channel-inbox | head -2 | tail -1 | awk '{print $1}')
    
    if [ -z "$PREVIOUS_IMAGE" ]; then
        log "❌ No previous image found"
        return 1
    fi
    
    log "📦 Rolling back to image: $PREVIOUS_IMAGE"
    
    # Update docker-compose to use previous image
    docker-compose -f "$COMPOSE_FILE" down app
    docker tag "$PREVIOUS_IMAGE" unified-multi-channel-inbox:latest
    docker-compose -f "$COMPOSE_FILE" up -d app
    
    # Wait for health check
    log "🏥 Waiting for application health check..."
    timeout=60
    while ! curl -f http://localhost:3000/api/health > /dev/null 2>&1; do
        sleep 5
        timeout=$((timeout - 5))
        if [ $timeout -le 0 ]; then
            log "❌ Health check failed after rollback"
            return 1
        fi
    done
    
    log "✅ Image rollback completed successfully"
}

# Function to rollback database
rollback_database() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        log "❌ Backup file not found: $backup_file"
        return 1
    fi
    
    log "🗄️ Rolling back database from: $backup_file"
    
    # Create current backup before rollback
    CURRENT_BACKUP="$BACKUP_DIR/pre-rollback-$(date +%Y%m%d-%H%M%S).sql"
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U postgres unified_inbox > "$CURRENT_BACKUP"
    log "💾 Current state backed up to: $CURRENT_BACKUP"
    
    # Stop application to prevent new connections
    docker-compose -f "$COMPOSE_FILE" stop app
    
    # Restore database
    docker-compose -f "$COMPOSE_FILE" exec -T postgres dropdb -U postgres unified_inbox --if-exists
    docker-compose -f "$COMPOSE_FILE" exec -T postgres createdb -U postgres unified_inbox
    docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres unified_inbox < "$backup_file"
    
    # Restart application
    docker-compose -f "$COMPOSE_FILE" start app
    
    log "✅ Database rollback completed"
}

# Main rollback logic
case "${1:-}" in
    "image")
        log "🔄 Performing image rollback..."
        rollback_image
        ;;
    "database")
        if [ -z "$2" ]; then
            log "❌ Please specify backup file for database rollback"
            list_backups
            exit 1
        fi
        rollback_database "$2"
        ;;
    "full")
        if [ -z "$2" ]; then
            log "❌ Please specify backup file for full rollback"
            list_backups
            exit 1
        fi
        log "🔄 Performing full rollback (image + database)..."
        rollback_database "$2"
        rollback_image
        ;;
    *)
        echo "Usage: $0 {image|database|full} [backup_file]"
        echo ""
        echo "Commands:"
        echo "  image                    - Rollback to previous Docker image"
        echo "  database <backup_file>   - Rollback database from backup"
        echo "  full <backup_file>       - Rollback both image and database"
        echo ""
        list_backups
        exit 1
        ;;
esac

# Final health check
log "🏥 Performing final health check..."
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    log "✅ Rollback completed successfully!"
    log "🌐 Application is running at http://localhost:3000"
else
    log "❌ Health check failed after rollback"
    exit 1
fi