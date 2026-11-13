#!/bin/bash
# ==============================================================================
# Database Restore Script for Cloud Virtual Lab & Secure Storage
# Compatible with Docker and Direct PostgreSQL Deployments
# ==============================================================================

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  echo "Example: $0 ./backups/database/cvl_backup_20261113_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ Error: Backup file '${BACKUP_FILE}' does not exist."
  exit 1
fi

echo "=================================================="
echo " Cloud Virtual Lab - Database Restore"
echo " Source File: ${BACKUP_FILE}"
echo "=================================================="
read -p "⚠️  This will overwrite matching database records. Proceed? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Restore canceled by user."
  exit 0
fi

if [ -n "${DOCKER_CONTAINER:-}" ]; then
  echo "Restoring to Docker container: ${DOCKER_CONTAINER}..."
  gunzip -c "${BACKUP_FILE}" | docker exec -i "${DOCKER_CONTAINER}" psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-cloud_virtual_lab}"
elif [ -n "${DATABASE_URL:-}" ]; then
  echo "Restoring using DATABASE_URL..."
  gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}"
else
  echo "Restoring to localhost:5432..."
  gunzip -c "${BACKUP_FILE}" | psql -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-cloud_virtual_lab}"
fi

echo "✅ Database restored successfully from ${BACKUP_FILE}!"
