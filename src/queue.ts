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
