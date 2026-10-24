#!/bin/sh
# Web and worker share this entry. With no BETTER_AUTH_SECRET set, one is made on first start and kept in the
# /data volume, so sessions survive restarts and the two services sign with the same secret.
set -e
if [ -z "$BETTER_AUTH_SECRET" ]; then
  if [ ! -s /data/secret ]; then
    mkdir -p /data
    node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))" > /data/secret
  fi
  BETTER_AUTH_SECRET="$(cat /data/secret)"
  export BETTER_AUTH_SECRET
fi
exec "$@"
