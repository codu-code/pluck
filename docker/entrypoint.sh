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
# The blob store's default secret is in this public repo. It is fine on one machine; anywhere else it opens every
# library to anyone who has read docker-compose.yml, so refuse to start with it.
if [ "$AWS_SECRET_ACCESS_KEY" = "pluck-change-me" ]; then
  for url in "$BETTER_AUTH_URL" "$S3_PUBLIC_ENDPOINT"; do
    case "$url" in
      http://localhost|http://localhost:*|http://127.0.0.1|http://127.0.0.1:*) ;;
      *) echo "Pluck: $url is not this machine, so set S3_SECRET_KEY to a long random value (openssl rand -hex 32). See docs/self-host.md." >&2; exit 1 ;;
    esac
  done
fi
exec "$@"
