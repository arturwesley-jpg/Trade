#!/bin/bash

# Automated Backup Script for Crypto Trading Bot
# Backs up PostgreSQL database, Redis data, and configuration files

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/trading-bot}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${TIMESTAMP}"

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-trading_bot}"
DB_USER="${DB_USER:-postgres}"

# Redis configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

# S3 configuration (optional)
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-backups}"

# Notification configuration
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Send notification
send_notification() {
    local status=$1
    local message=$2

    # Slack notification
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"🔄 Backup $status: $message\"}" \
            2>/dev/null || log_warn "Failed to send Slack notification"
    fi

    # Telegram notification
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            -d "text=🔄 Backup $status: $message" \
            2>/dev/null || log_warn "Failed to send Telegram notification"
    fi
}

# Create backup directory
create_backup_dir() {
    log_info "Creating backup directory: ${BACKUP_DIR}/${BACKUP_NAME}"
    mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"
}

# Backup PostgreSQL database
backup_postgres() {
    log_info "Backing up PostgreSQL database: ${DB_NAME}"

    local backup_file="${BACKUP_DIR}/${BACKUP_NAME}/postgres_${DB_NAME}.sql.gz"

    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=custom \
        --compress=9 \
        --verbose \
        2>&1 | gzip > "$backup_file"

    local size=$(du -h "$backup_file" | cut -f1)
    log_info "PostgreSQL backup completed: $backup_file ($size)"
}

# Backup Redis data
backup_redis() {
    log_info "Backing up Redis data"

    local backup_file="${BACKUP_DIR}/${BACKUP_NAME}/redis_dump.rdb"

    # Trigger Redis BGSAVE
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" BGSAVE >/dev/null

    # Wait for BGSAVE to complete
    while [ "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LASTSAVE)" == "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LASTSAVE)" ]; do
        sleep 1
    done

    # Copy dump.rdb
    local redis_dump="/var/lib/redis/dump.rdb"
    if [ -f "$redis_dump" ]; then
        cp "$redis_dump" "$backup_file"
        gzip "$backup_file"
        local size=$(du -h "${backup_file}.gz" | cut -f1)
        log_info "Redis backup completed: ${backup_file}.gz ($size)"
    else
        log_warn "Redis dump file not found at $redis_dump"
    fi
}

# Backup configuration files
backup_config() {
    log_info "Backing up configuration files"

    local config_backup="${BACKUP_DIR}/${BACKUP_NAME}/config"
    mkdir -p "$config_backup"

    # Backup .env files (excluding sensitive data)
    if [ -f ".env" ]; then
        grep -v -E "(API_KEY|SECRET|PASSWORD|TOKEN)" .env > "${config_backup}/.env.template" || true
    fi

    # Backup docker-compose files
    cp docker-compose*.yml "$config_backup/" 2>/dev/null || true

    # Backup Kubernetes manifests
    if [ -d "infrastructure/k8s" ]; then
        cp -r infrastructure/k8s "$config_backup/" 2>/dev/null || true
    fi

    # Backup Grafana dashboards
    if [ -d "infrastructure/monitoring/grafana/dashboards" ]; then
        cp -r infrastructure/monitoring/grafana/dashboards "$config_backup/" 2>/dev/null || true
    fi

    log_info "Configuration backup completed"
}

# Create backup manifest
create_manifest() {
    log_info "Creating backup manifest"

    local manifest="${BACKUP_DIR}/${BACKUP_NAME}/manifest.json"

    cat > "$manifest" <<EOF
{
  "backup_name": "${BACKUP_NAME}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$(hostname)",
  "database": {
    "host": "${DB_HOST}",
    "port": ${DB_PORT},
    "name": "${DB_NAME}"
  },
  "redis": {
    "host": "${REDIS_HOST}",
    "port": ${REDIS_PORT}
  },
  "files": [
$(find "${BACKUP_DIR}/${BACKUP_NAME}" -type f -exec basename {} \; | sed 's/^/    "/' | sed 's/$/",/' | sed '$ s/,$//')
  ]
}
EOF

    log_info "Manifest created: $manifest"
}

# Compress backup
compress_backup() {
    log_info "Compressing backup"

    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"

    local size=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
    log_info "Backup compressed: ${BACKUP_NAME}.tar.gz ($size)"

    # Remove uncompressed directory
    rm -rf "$BACKUP_NAME"
}

# Upload to S3 (optional)
upload_to_s3() {
    if [ -z "$S3_BUCKET" ]; then
        log_info "S3 upload skipped (S3_BUCKET not configured)"
        return
    fi

    log_info "Uploading backup to S3: s3://${S3_BUCKET}/${S3_PREFIX}/"

    aws s3 cp \
        "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" \
        "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_NAME}.tar.gz" \
        --storage-class STANDARD_IA

    log_info "S3 upload completed"
}

# Clean old backups
clean_old_backups() {
    log_info "Cleaning backups older than ${RETENTION_DAYS} days"

    find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +${RETENTION_DAYS} -delete

    local count=$(find "$BACKUP_DIR" -name "backup_*.tar.gz" | wc -l)
    log_info "Cleanup completed. Remaining backups: $count"
}

# Verify backup integrity
verify_backup() {
    log_info "Verifying backup integrity"

    if tar -tzf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" >/dev/null 2>&1; then
        log_info "Backup integrity verified successfully"
        return 0
    else
        log_error "Backup integrity check failed"
        return 1
    fi
}

# Main backup process
main() {
    log_info "Starting backup process"

    local start_time=$(date +%s)

    # Check required commands
    for cmd in pg_dump redis-cli tar gzip; do
        if ! command -v $cmd &> /dev/null; then
            log_error "Required command not found: $cmd"
            send_notification "FAILED" "Required command not found: $cmd"
            exit 1
        fi
    done

    # Create backup directory
    create_backup_dir

    # Perform backups
    backup_postgres || { log_error "PostgreSQL backup failed"; exit 1; }
    backup_redis || log_warn "Redis backup failed (non-critical)"
    backup_config

    # Create manifest
    create_manifest

    # Compress backup
    compress_backup

    # Verify backup
    if ! verify_backup; then
        send_notification "FAILED" "Backup integrity check failed"
        exit 1
    fi

    # Upload to S3
    upload_to_s3 || log_warn "S3 upload failed (non-critical)"

    # Clean old backups
    clean_old_backups

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log_info "Backup process completed successfully in ${duration}s"
    send_notification "SUCCESS" "Backup completed in ${duration}s: ${BACKUP_NAME}.tar.gz"
}

# Run main function
main "$@"
