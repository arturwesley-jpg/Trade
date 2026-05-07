#!/bin/bash

# Automated Restore Script for Crypto Trading Bot
# Restores PostgreSQL database, Redis data, and configuration files from backup

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/trading-bot}"
RESTORE_BACKUP="${1:-latest}"

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-trading_bot}"
DB_USER="${DB_USER:-postgres}"

# Redis configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

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

# Find backup file
find_backup() {
    if [ "$RESTORE_BACKUP" == "latest" ]; then
        BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/backup_*.tar.gz 2>/dev/null | head -1)
    else
        BACKUP_FILE="${BACKUP_DIR}/${RESTORE_BACKUP}.tar.gz"
    fi

    if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi

    log_info "Using backup: $BACKUP_FILE"
}

# Extract backup
extract_backup() {
    log_info "Extracting backup"

    TEMP_DIR=$(mktemp -d)
    tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

    BACKUP_NAME=$(basename "$BACKUP_FILE" .tar.gz)
    EXTRACT_DIR="${TEMP_DIR}/${BACKUP_NAME}"

    log_info "Backup extracted to: $EXTRACT_DIR"
}

# Verify backup integrity
verify_backup() {
    log_info "Verifying backup manifest"

    if [ ! -f "${EXTRACT_DIR}/manifest.json" ]; then
        log_error "Manifest file not found"
        exit 1
    fi

    log_info "Manifest verified"
    cat "${EXTRACT_DIR}/manifest.json"
}

# Restore PostgreSQL database
restore_postgres() {
    log_info "Restoring PostgreSQL database: ${DB_NAME}"

    local backup_file=$(find "$EXTRACT_DIR" -name "postgres_*.sql.gz" | head -1)

    if [ -z "$backup_file" ]; then
        log_error "PostgreSQL backup file not found"
        exit 1
    fi

    # Drop existing database (with confirmation)
    read -p "⚠️  This will DROP and recreate database '${DB_NAME}'. Continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log_error "Restore cancelled by user"
        exit 1
    fi

    # Drop and recreate database
    PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres <<EOF
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME};
EOF

    # Restore database
    gunzip -c "$backup_file" | PGPASSWORD="${DB_PASSWORD}" pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --verbose \
        --no-owner \
        --no-acl

    log_info "PostgreSQL restore completed"
}

# Restore Redis data
restore_redis() {
    log_info "Restoring Redis data"

    local backup_file=$(find "$EXTRACT_DIR" -name "redis_dump.rdb.gz" | head -1)

    if [ -z "$backup_file" ]; then
        log_warn "Redis backup file not found, skipping"
        return
    fi

    # Stop Redis
    log_info "Stopping Redis"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SHUTDOWN NOSAVE || true
    sleep 2

    # Restore dump.rdb
    local redis_dump="/var/lib/redis/dump.rdb"
    gunzip -c "$backup_file" > "$redis_dump"

    # Start Redis
    log_info "Starting Redis"
    systemctl start redis || redis-server --daemonize yes

    log_info "Redis restore completed"
}

# Restore configuration files
restore_config() {
    log_info "Restoring configuration files"

    local config_dir="${EXTRACT_DIR}/config"

    if [ ! -d "$config_dir" ]; then
        log_warn "Configuration backup not found, skipping"
        return
    fi

    # List files to restore
    log_info "Configuration files available:"
    find "$config_dir" -type f

    read -p "Restore configuration files? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log_info "Configuration restore skipped"
        return
    fi

    # Restore files (with backup of existing)
    if [ -f ".env" ]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    fi

    cp -r "$config_dir"/* .

    log_info "Configuration restore completed"
}

# Cleanup
cleanup() {
    log_info "Cleaning up temporary files"
    rm -rf "$TEMP_DIR"
}

# Main restore process
main() {
    log_info "Starting restore process"

    local start_time=$(date +%s)

    # Check required commands
    for cmd in psql pg_restore redis-cli tar gzip; do
        if ! command -v $cmd &> /dev/null; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done

    # Find and extract backup
    find_backup
    extract_backup
    verify_backup

    # Perform restore
    restore_postgres
    restore_redis || log_warn "Redis restore failed (non-critical)"
    restore_config

    # Cleanup
    cleanup

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log_info "Restore process completed successfully in ${duration}s"
}

# Run main function
main "$@"
