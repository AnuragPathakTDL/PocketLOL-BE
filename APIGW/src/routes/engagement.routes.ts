import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import {
  engagementEventBodySchema,
  engagementEventSuccessResponseSchema,
  type EngagementEventBody,
  type EngagementEventData,
} from "../schemas/engagement.schema";
import { errorResponseSchema } from "../schemas/base.schema";
import { publishEngagementEvent } from "../proxy/engagement.proxy";

export default fp(
  async function engagementRoutes(fastify: FastifyInstance) {
    fastify.route<{
      Body: EngagementEventBody;
      Reply: EngagementEventData;
    }>({
      method: "POST",
      url: "/like",
      schema: {
        body: engagementEventBodySchema,
        response: {
          200: engagementEventSuccessResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
      config: {
        auth: { public: false },
        rateLimitPolicy: "authenticated",
        security: { bodyLimit: 8 * 1024 },
      },
      preHandler: [fastify.authorize(["user", "admin"])],
      async handler(request) {
        const body = engagementEventBodySchema.parse({
          ...request.body,
          action: request.body?.action ?? "like",
        });
        const response = await publishEngagementEvent(
          body,
          request.correlationId,
          request.user!,
          request.telemetrySpan
        );
        request.log.info(
          { videoId: body.videoId, action: body.action },
          "Engagement event forwarded"
        );
        return response;
      },
    });
  },
  { name: "engagement-routes" }
);
