# PocketLOL Microservices

This workspace contains the complete PocketLOL microservices stack including the API Gateway, Auth Service, User Service, Content Service, Engagement Service, Search Service, Streaming Service, and Upload Service. The stack ships with a unified Docker Compose workflow so you can run the full architecture locally with one command.

## Prerequisites

- Docker 24+ (or Docker Desktop)

## Environment Setup

1. Copy the template and populate your secrets (JWT keys, service token, etc.). The populated file is Git-ignored by default:

    ```bash
    cp infra-local/.env.example infra-local/.env
    ```

2. Edit `infra-local/.env` and update at least the following values:
    - `SERVICE_AUTH_TOKEN` — shared token for internal service auth
    - `AUTH_JWT_PRIVATE_KEY` / `AUTH_JWT_PUBLIC_KEY` — PEM-encoded keys for AuthService
    - Database credentials if you are not using the defaults

    Keep the PEM content wrapped in quotes so Docker Compose injects the line breaks correctly. Never commit the filled `.env` file.

## Build, Run, and Rebuild

From the repository root (or inside `infra-local/`), use the commands below.

- **Initial build and launch**

   ```bash
   docker compose --env-file .env up --build
   ```

   The first run seeds `pocketlol_auth` and `pocketlol_users` and applies Prisma migrations automatically. After the health checks pass, services are reachable at:
  - API Gateway → <http://localhost:${GATEWAY_HTTP_HOST_PORT:-3000}>
  - Auth Service → <http://localhost:${AUTH_SERVICE_HTTP_HOST_PORT:-4000}>
  - User Service → <http://localhost:${USER_SERVICE_HTTP_HOST_PORT:-4500}> (gRPC at `localhost:${USER_SERVICE_GRPC_HOST_PORT:-50052}`)
  - Content Service → <http://localhost:${CONTENT_SERVICE_HTTP_HOST_PORT:-4600}>
  - Engagement Service → <http://localhost:${ENGAGEMENT_SERVICE_HTTP_HOST_PORT:-4700}>
  - Search Service → <http://localhost:${SEARCH_SERVICE_HTTP_HOST_PORT:-4800}>
  - Streaming Service → <http://localhost:${STREAMING_SERVICE_HTTP_HOST_PORT:-4900}>
  - Upload Service → <http://localhost:${UPLOAD_SERVICE_HTTP_HOST_PORT:-5000}>

- **Stop the stack** (graceful shutdown)

   ```bash
   docker compose --env-file .env down
   ```

- **Rebuild after code changes** (forces image rebuild before starting)

   ```bash
   docker compose --env-file .env up --build --force-recreate --remove-orphans
   ```

- **Recreate without rebuilding images** (useful after config changes only)

   ```bash
   docker compose --env-file .env up --force-recreate
   ```

- **Clean everything** (containers, networks, volumes)

   ```bash
   docker compose --env-file .env down --volumes --remove-orphans
   ```

   Run this when you want to reset databases or caches.

The shared service token is read from `.env` so all containers use the same value automatically.

## Data & Migrations

- PostgreSQL runs inside Docker with a persistent `postgres-data` volume.
- Databases `pocketlol_auth` and `pocketlol_users` are created via `docker/postgres/01-init-databases.sql`.
- Each service entrypoint runs `prisma migrate deploy` (or `prisma db push` when no migrations exist) before starting the HTTP server.

## GitHub & CI/CD

- Store sensitive values (service token, JWT keys, database passwords) as GitHub Secrets. Suggested names: `INFRA_SERVICE_AUTH_TOKEN`, `INFRA_JWT_PRIVATE_KEY`, etc.
- CI workflows can reconstruct the `.env` file from secrets and execute

   ```bash
   docker compose --env-file .env up --build --detach
   ```

   on the runner or target host.
- Self-hosted runners should mount this directory so they reuse the same compose stack as developers.

## Local Development Outside Docker

You can still run services directly with Node.js. Refer to the service-specific guides:

- [APIGW/README.md](../APIGW/README.md)
- [AuthService/README.md](../AuthService/README.md)
- [UserService/README.md](../UserService/README.md)
- [ContentService/README.md](../ContentService/README.md)
- [EngagementService/README.md](../EngagementService/README.md)
- [SearchService/README.md](../SearchService/README.md)
- [StreamingService/README.md](../StreamingService/README.md)
- [UploadService/README.md](../UploadService/README.md)

Keep each service's standalone `.env` files in sync with the values defined in `infra-local/.env` (especially `SERVICE_AUTH_TOKEN` and database connection strings) to avoid mismatched credentials.
