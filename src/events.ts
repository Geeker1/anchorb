import { QueueEvents } from 'bullmq';
import { redis } from './queue';
import { JobPayload } from './types';

import { logger } from "./logger";

// The purpose of this file is to efficiently track the state of jobs
// create job payload and add to queue when necessary for later reference.

const queueEvents = new QueueEvents("anchorb", { connection: { host: "redis" } });

const getPayload = (status: "waiting" | "active" | "completed" | "failed", data: any = null, message: string = ""): JobPayload => {
    return {
        status,
        data,
        message
    }
}

export const EVENT_PREFIX = "events";

queueEvents.on('waiting', async ({ jobId }) => {
  logger.info(`[${jobId}] | status: "waiting"`);
  const payload = getPayload("waiting")
  await redis.set(`${EVENT_PREFIX}-${jobId}`, JSON.stringify(payload))
});

queueEvents.on('active', async ({ jobId, prev }) => {
  logger.info(`[${jobId}] | status: "active"`);
  const payload = getPayload("active")
  await redis.set(`${EVENT_PREFIX}-${jobId}`, JSON.stringify(payload))
});

queueEvents.on('completed', async ({ jobId, returnvalue }) => {
  logger.info(`[${jobId}] | status: "completed"`);
  const payload = getPayload("completed", returnvalue, "data scrape successful")
  await redis.set(`${EVENT_PREFIX}-${jobId}`, JSON.stringify(payload))
});

queueEvents.on('failed', async ({ jobId, failedReason }) => {
  logger.error(`[${jobId}] | status: "failed" | reason: "${failedReason}"`);
  const payload = getPayload("failed", null, failedReason)
  await redis.set(`${EVENT_PREFIX}-${jobId}`, JSON.stringify(payload))
});
