import type { Span } from "@opentelemetry/api";
import { resolveServiceUrl } from "../config";
import { performServiceRequest, UpstreamServiceError } from "../utils/http";
import { createHttpError } from "../utils/errors";
import {
  engagementEventBodySchema,
  engagementEventDataSchema,
  type EngagementEventBody,
  type EngagementEventData,
} from "../schemas/engagement.schema";
import type { GatewayUser } from "../types";

export async function publishEngagementEvent(
  body: EngagementEventBody,
  correlationId: string,
  user: GatewayUser,
  span?: Span
): Promise<EngagementEventData> {
  const baseUrl = resolveServiceUrl("engagement");
  const validatedBody = engagementEventBodySchema.parse(body);

  let payload: unknown;
  try {
    const response = await performServiceRequest<EngagementEventData>({
      serviceName: "engagement",
      baseUrl,
      path: "/internal/events",
      method: "POST",
      correlationId,
      user,
      body: validatedBody,
      parentSpan: span,
      spanName: "proxy:engagement:publishEvent",
    });
    payload = response.payload;
  } catch (error) {
    if (error instanceof UpstreamServiceError) {
      throw createHttpError(
        error.statusCode >= 500 ? 502 : error.statusCode,
        "Failed to publish engagement event",
        error.cause
      );
    }
    throw error;
  }

  const parsed = engagementEventDataSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Invalid response from engagement service");
  }

  return parsed.data;
}
