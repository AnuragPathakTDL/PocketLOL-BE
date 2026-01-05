#!/bin/sh
set -euo pipefail

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is required" >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required" >&2
  exit 1
fi

NAMESPACE="${1:-dev}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
SQL_INSTANCE="${SQL_INSTANCE:-pocketlol-pg}"

if [ -z "${PROJECT_ID:-}" ]; then
  echo "PROJECT_ID must be set (or gcloud default project configured)" >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

echo "Using project: $PROJECT_ID"
echo "Using namespace: $NAMESPACE"

kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"

SERVICE_AUTH_TOKEN="$(gcloud secrets versions access latest --project "$PROJECT_ID" --secret service-auth-token)"
DB_USER="$(gcloud secrets versions access latest --project "$PROJECT_ID" --secret db-user)"
DB_PASS="$(gcloud secrets versions access latest --project "$PROJECT_ID" --secret db-password)"

CLOUD_SQL_CONNECTION_NAME="${CLOUD_SQL_CONNECTION_NAME:-$(gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" --format='value(connectionName)')}"

echo "Creating shared-secrets"
kubectl -n "$NAMESPACE" delete secret shared-secrets >/dev/null 2>&1 || true
kubectl -n "$NAMESPACE" create secret generic shared-secrets \
  --from-literal=SERVICE_AUTH_TOKEN="$SERVICE_AUTH_TOKEN"

echo "Creating cloudsql-secrets"
kubectl -n "$NAMESPACE" delete secret cloudsql-secrets >/dev/null 2>&1 || true
kubectl -n "$NAMESPACE" create secret generic cloudsql-secrets \
  --from-literal=CLOUD_SQL_CONNECTION_NAME="$CLOUD_SQL_CONNECTION_NAME"

mk_db_url() {
  db="$1"
  echo "postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${db}?schema=public"
}

create_db_secret() {
  name="$1"
  db="$2"
  url="$(mk_db_url "$db")"

  kubectl -n "$NAMESPACE" delete secret "${name}" >/dev/null 2>&1 || true
  kubectl -n "$NAMESPACE" create secret generic "${name}" --from-literal=DATABASE_URL="$url"
}

echo "Creating DB secrets"
create_db_secret content-service-secrets pocketlol_content
create_db_secret upload-service-secrets pocketlol_upload
create_db_secret subscription-service-secrets pocketlol_subscription

echo "Creating user-service-secrets"
kubectl -n "$NAMESPACE" delete secret user-service-secrets >/dev/null 2>&1 || true
kubectl -n "$NAMESPACE" create secret generic user-service-secrets \
  --from-literal=DATABASE_URL="$(mk_db_url pocketlol_users)" \
  --from-literal=AUTH_SERVICE_TOKEN="$SERVICE_AUTH_TOKEN"

echo "Creating auth-service-secrets"
gcloud secrets versions access latest --project "$PROJECT_ID" --secret auth-jwt-private-key >"$tmpdir/auth_jwt_private.pem"
gcloud secrets versions access latest --project "$PROJECT_ID" --secret auth-jwt-public-key >"$tmpdir/auth_jwt_public.pem"

kubectl -n "$NAMESPACE" delete secret auth-service-secrets >/dev/null 2>&1 || true
kubectl -n "$NAMESPACE" create secret generic auth-service-secrets \
  --from-literal=DATABASE_URL="$(mk_db_url pocketlol_auth)" \
  --from-file=AUTH_JWT_PRIVATE_KEY="$tmpdir/auth_jwt_private.pem" \
  --from-file=AUTH_JWT_PUBLIC_KEY="$tmpdir/auth_jwt_public.pem" \
  --from-literal=USER_SERVICE_TOKEN="$SERVICE_AUTH_TOKEN" \
  --from-literal=FIREBASE_CREDENTIALS_B64="${FIREBASE_CREDENTIALS_B64:-}"

echo "Done. Next: fill ConfigMaps for Redis/GCS/PubSub and apply kustomize overlay."
