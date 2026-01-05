import fp from "fastify-plugin";
import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import type { FastifyReply, FastifyRequest } from "fastify";
import { loadConfig } from "../config";
import type { GatewayUser, GatewayRole, GatewayUserType } from "../types";

const AUTH_HEADER_PREFIX = "Bearer ";

function extractTokenFromHeader(authHeader?: string) {
  if (!authHeader || !authHeader.startsWith(AUTH_HEADER_PREFIX)) {
    return null;
  }
  return authHeader.substring(AUTH_HEADER_PREFIX.length);
}

function toGatewayUser(payload: JWTPayload): GatewayUser {
  const subject = String(payload.sub ?? "");
  const rawType =
    typeof payload["userType"] === "string"
      ? (payload["userType"] as string).toUpperCase()
      : "GUEST";
  const userType: GatewayUserType = ["ADMIN", "CUSTOMER", "GUEST"].includes(
    rawType
  )
    ? (rawType as GatewayUserType)
    : "GUEST";

  const roles: GatewayRole[] =
    userType === "ADMIN" && Array.isArray(payload["roles"])
      ? (payload["roles"] as unknown[]).map((role) => String(role))
      : [];

  return {
    id: subject,
    subject,
    userType,
    roles,
    scopes: Array.isArray(payload["scopes"])
      ? (payload["scopes"] as unknown[]).map((scope) => String(scope))
      : [],
    deviceId:
      typeof payload["deviceId"] === "string"
        ? String(payload["deviceId"])
        : undefined,
    firebaseUid:
      typeof payload["firebaseUid"] === "string"
        ? String(payload["firebaseUid"])
        : undefined,
    guestId:
      typeof payload["guestId"] === "string"
        ? String(payload["guestId"])
        : undefined,
    tenantId: payload["tenant"] ? String(payload["tenant"]) : undefined,
    languageId: payload["languageId"]
      ? String(payload["languageId"])
      : undefined,
    ...payload,
  };
}

export default fp(
  async function authPlugin(fastify) {
    const config = loadConfig();

    const jwks = createRemoteJWKSet(new URL(config.AUTH_JWKS_URL), {
      cacheMaxAge: config.AUTH_CACHE_TTL_SECONDS * 1000,
    });

    async function verifyAuth(request: FastifyRequest, reply: FastifyReply) {
      const routeAuthConfig =
        (
          request.routeOptions.config as
            | { auth?: { public?: boolean } }
            | undefined
        )?.auth ?? {};
      if (routeAuthConfig && routeAuthConfig.public) {
        return;
      }

      const token = extractTokenFromHeader(request.headers.authorization);
      if (!token) {
        await fastify.publishAuditEvent({
          type: "auth.failure",
          correlationId: request.correlationId,
          subject: request.headers["x-request-id"]?.toString(),
          ip: request.ip,
          metadata: {
            reason: "missing_token",
            path: request.url,
            method: request.method,
          },
        });
        reply.code(401);
        throw new Error("Authorization header missing or malformed");
      }

      try {
        const verification = await jwtVerify(token, jwks, {
          issuer: config.AUTH_ISSUER,
          audience: config.AUTH_AUDIENCE,
        });

        request.user = toGatewayUser(verification.payload);
      } catch (error) {
        fastify.log.warn(
          { err: error, correlationId: request.correlationId },
          "JWT verification failed"
        );
        await fastify.publishAuditEvent({
          type: "auth.failure",
          correlationId: request.correlationId,
          subject: request.user?.id,
          ip: request.ip,
          tenantId: request.user?.tenantId,
          metadata: {
            reason: "invalid_token",
            path: request.url,
            method: request.method,
          },
        });
        reply.code(401);
        throw new Error("Invalid or expired token");
      }
    }

    function normalizeUserType(value: string): GatewayUserType | undefined {
      const upper = value.trim().toUpperCase();
      if (upper === "USER" || upper === "CUSTOMER") {
        return "CUSTOMER";
      }
      if (upper === "ADMIN") {
        return "ADMIN";
      }
      if (upper === "GUEST") {
        return "GUEST";
      }
      return undefined;
    }

    function authorize(allowedTypes: readonly GatewayRole[]) {
      const normalizedAllowed = allowedTypes
        .map((type) => normalizeUserType(String(type)))
        .filter((type): type is GatewayUserType => Boolean(type));

      return async function (request: FastifyRequest, reply: FastifyReply) {
        if (!request.user) {
          reply.code(401);
          throw new Error("Authentication required");
        }

        if (normalizedAllowed.length === 0) {
          return;
        }

        if (!normalizedAllowed.includes(request.user.userType)) {
          reply.code(403);
          throw new Error("User type not permitted");
        }
      };
    }

    fastify.decorate("verifyAuth", verifyAuth);
    fastify.decorate("authorize", authorize);

    fastify.addHook("preHandler", async (request, reply) => {
      await verifyAuth(request, reply);
    });
  },
  { name: "auth" }
);
