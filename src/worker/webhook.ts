import { WEBHOOK_URL } from "../constants";
import { logger } from "../logger";
import { redis, retryQueue } from "../queue";
import { BookData } from "../types";
import pushToMakeWebHook from "./jobs/make";

export const handleWebhookPush = async (books: BookData[], searchTerm: string) => {
    try {
        await pushToMakeWebHook(books, WEBHOOK_URL);
    } catch (error) {
        const retryId = `retry:job:${Date.now()}`;
        const jobData = {
            books,
            searchTerm,
            failedStep: "pushToMakeWebHook",
            retryId
        };
        // If we have a books batch, mark the job as failed
        await redis.set(retryId, JSON.stringify(jobData));
        const job = await retryQueue.add(`scrape:${retryId}`, { retryId });
        logger.info(`Job ${job.id} added to retry queue for batch processing.`);
    }
};
