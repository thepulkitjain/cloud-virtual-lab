#!/bin/bash
# ==============================================================================
# Database Backup Script for Cloud Virtual Lab & Secure Storage
# Compatible with Docker and Direct PostgreSQL Deployments
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups/database}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/cvl_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "=================================================="
echo " Cloud Virtual Lab - Database Backup"
echo " Timestamp: ${TIMESTAMP}"
echo "=================================================="

if [ -n "${DOCKER_CONTAINER:-}" ]; then
  echo "Backing up from Docker container: ${DOCKER_CONTAINER}..."
  docker exec -t "${DOCKER_CONTAINER}" pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-cloud_virtual_lab}" | gzip > "${BACKUP_FILE}"
elif [ -n "${DATABASE_URL:-}" ]; then
  echo "Backing up using DATABASE_URL..."
  pg_dump "${DATABASE_URL}" | gzip > "${BACKUP_FILE}"
else
  echo "Backing up from localhost:5432..."
  pg_dump -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-cloud_virtual_lab}" | gzip > "${BACKUP_FILE}"
fi

FILESIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✅ Database backup created successfully!"
echo "📁 File: ${BACKUP_FILE} (${FILESIZE})"
