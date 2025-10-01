#!/bin/bash

# scripts/migrate-all.sh <migration-file.sql>

set -e

if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-username}
DB_PASSWORD=${DB_PASSWORD:-password}
DB_NAME=${DB_NAME:-planty}

if [ -z "$1" ]; then
  exit 1
fi

MIGRATION_FILE=$1

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "File not found: $MIGRATION_FILE"
  exit 1
fi

echo "Running: $MIGRATION_FILE"
echo "Database: $DB_NAME on $DB_HOST:$DB_PORT"

export PGPASSWORD=$DB_PASSWORD
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $MIGRATION_FILE

echo "Migration completed."
