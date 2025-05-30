import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const redis = new IORedis({
    port: 6379,
    host: "redis",
    maxRetriesPerRequest: null
});

export const anchorQueue = new Queue('anchorb', {
    connection: redis, defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
    },
});

// Seperate queue for retrying failed jobs
export const retryQueue = new Queue('anchorb-retry', {
    connection: redis, defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
    },
});
