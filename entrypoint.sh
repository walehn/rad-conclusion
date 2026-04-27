#!/bin/sh
set -e
node /app/scripts/migrate.js
exec node /app/server.js
