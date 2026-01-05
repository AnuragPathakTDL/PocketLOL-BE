import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import {
  engagementEventBodySchema,
  continueWatchQuerySchema,
  continueWatchResponseSchema,
  continueWatchUpsertSchema,
  type EngagementEventMetrics,
} from "../schemas/engagement";
import {
  applyEngagementEvent,
  getProgressEntries,
  upsertProgress,
} from "../services/engagement";

export default fp(async function internalRoutes(fastify: FastifyInstance) {
  fastify.post("/events", {
    schema: {
      body: engagementEventBodySchema,
    },
    handler: async (request): Promise<EngagementEventMetrics> => {
      const body = engagementEventBodySchema.parse(request.body);
      const stats = applyEngagementEvent(body.videoId, body);
      request.log.info(
        { videoId: body.videoId, action: body.action },
        "Processed engagement event"
      );
      return {
        likes: stats.likes,
        views: stats.views,
      };
    },
  });

  fastify.post("/progress", {
    schema: {
      body: continueWatchUpsertSchema,
    },
    handler: async (request) => {
      const body = continueWatchUpsertSchema.parse(request.body);
      const entry = upsertProgress({
        userId: body.userId,
        episodeId: body.episodeId,
        watchedDuration: body.watchedDuration,
        totalDuration: body.totalDuration,
        lastWatchedAt: body.lastWatchedAt ?? undefined,
        isCompleted: body.isCompleted,
      });

      request.log.info(
        { userId: body.userId, episodeId: body.episodeId },
        "Recorded continue watch progress"
      );

      return {
        episode_id: entry.episodeId,
        watched_duration: entry.watchedDuration,
        total_duration: entry.totalDuration,
        last_watched_at: entry.lastWatchedAt,
        is_completed: entry.isCompleted,
      };
    },
  });

  fastify.post("/progress/query", {
    schema: {
      body: continueWatchQuerySchema,
    },
    handler: async (request) => {
      const body = continueWatchQuerySchema.parse(request.body);
      const episodeIds = body.limit
        ? body.episodeIds.slice(0, body.limit)
        : body.episodeIds;
      const entries = getProgressEntries(body.userId, episodeIds);
      const payload = {
        entries: entries.map((entry) => ({
          episode_id: entry.episodeId,
          watched_duration: entry.watchedDuration,
          total_duration: entry.totalDuration,
          last_watched_at: entry.lastWatchedAt,
          is_completed: entry.isCompleted,
        })),
      };
      return continueWatchResponseSchema.parse(payload);
    },
  });
});
