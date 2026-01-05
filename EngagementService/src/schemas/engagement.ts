import { z } from "zod";

export const engagementEventBodySchema = z.object({
  videoId: z.string().uuid(),
  action: z.enum(["like", "unlike", "view", "favorite"]).default("like"),
  metadata: z
    .object({
      source: z.enum(["mobile", "web", "tv"]).optional(),
    })
    .optional(),
});

export const engagementEventMetricsSchema = z.object({
  likes: z.number().int().nonnegative(),
  views: z.number().int().nonnegative(),
});

export const continueWatchUpsertSchema = z.object({
  userId: z.string().uuid(),
  episodeId: z.string().uuid(),
  watchedDuration: z.number().int().nonnegative(),
  totalDuration: z.number().int().positive(),
  lastWatchedAt: z.string().datetime().nullable().optional(),
  isCompleted: z.boolean().optional(),
});

export const continueWatchQuerySchema = z.object({
  userId: z.string().uuid(),
  episodeIds: z.array(z.string().uuid()).min(1).max(100),
  limit: z.number().int().positive().max(100).optional(),
});

export const continueWatchResponseSchema = z.object({
  entries: z.array(
    z.object({
      episode_id: z.string().uuid(),
      watched_duration: z.number().int().nonnegative(),
      total_duration: z.number().int().positive(),
      last_watched_at: z.string().datetime().nullable(),
      is_completed: z.boolean(),
    })
  ),
});

export type EngagementEventBody = z.infer<typeof engagementEventBodySchema>;
export type EngagementEventMetrics = z.infer<
  typeof engagementEventMetricsSchema
>;
export type ContinueWatchUpsert = z.infer<typeof continueWatchUpsertSchema>;
export type ContinueWatchQuery = z.infer<typeof continueWatchQuerySchema>;
export type ContinueWatchResponse = z.infer<typeof continueWatchResponseSchema>;
