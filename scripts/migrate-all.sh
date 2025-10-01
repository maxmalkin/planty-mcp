#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"

if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

echo "Running all migrations..."

for migration in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$migration" ]; then
    echo ""
    echo "----------------------------------------"
    bash "$SCRIPT_DIR/migrate.sh" "$migration"
  fi
done

echo ""
echo "All migrations completed successfully"
