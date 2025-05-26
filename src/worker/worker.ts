import { redis } from "../queue";
import { Worker } from "bullmq";
import { logger } from "../logger";

import { scrapeBooksBySearchTerm } from "./jobs/scrape";
import { retryJob } from "./jobs/retry";

export const createWorker = () => {
    // Create a new worker that listens to the "anchorb" queue
    return new Worker(
        `anchorb`,
        async (job) => {
            logger.info(`Processing job with data: ${JSON.stringify(job.data)}`);
            return await scrapeBooksBySearchTerm(job.data.search);
        },
        { connection: redis }
    );
};

export const createRetryWorker = () => {
    // Create a new worker that listens to the "anchorb-retry" queue
    return new Worker(
        `anchorb-retry`,
        async (job) => {
            return await retryJob(job.data.retryId);
        },
        { connection: redis }
    );
};

export const startWorker = async (num_workers: number) => {
    // Spin up workers with the specified number of workers

    let workers: Worker[] = []
    for (let i = 0; i < num_workers; i++) {
        workers.push(createWorker());
    }

    // Add retry workers to queue
    // We only need half the number of retry workers as the main workers
    for (let i = 0; i < Math.round(num_workers/2); i++) {
        workers.push(createRetryWorker());
    }

    return workers
};
