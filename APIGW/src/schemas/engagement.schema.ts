import { z } from "zod";
import { createSuccessResponseSchema } from "./base.schema";
import type { SuccessResponse } from "../utils/envelope";

export const engagementEventBodySchema = z.object({
  videoId: z.string().uuid(),
  action: z.enum(["like", "unlike", "view", "favorite"]).default("like"),
  metadata: z
    .object({
      source: z.enum(["mobile", "web", "tv"]).optional(),
    })
    .optional(),
});

export const engagementEventDataSchema = z.object({
  likes: z.number().int().nonnegative().optional(),
  views: z.number().int().nonnegative().optional(),
});

export const engagementEventSuccessResponseSchema = createSuccessResponseSchema(
  engagementEventDataSchema
);

export type EngagementEventBody = z.infer<typeof engagementEventBodySchema>;
export type EngagementEventData = z.infer<typeof engagementEventDataSchema>;
export type EngagementEventSuccessResponse =
  SuccessResponse<EngagementEventData>;
