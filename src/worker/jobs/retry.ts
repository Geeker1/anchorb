import { devices } from "@playwright/test";
import { redis } from "../../queue";
import { BookData } from "../../types";
import { fetchBookDescription } from "./scrape";
import { summarizeBooksWithRelevance } from "../llmSummary";
import pushToMakeWebHook from "./make";
import { WEBHOOK_URL } from "../../constants";
import { getBrowserInstance } from "../../browser";

// This can be handled better with a state machine implementation or similar,
// but for simplicity, we will just retry the failed step based on the job data.
// The job data will contain the failed step and the books that were processed before the failure.
// The retryId is the job ID of the failed job in the retry queue.
export const retryJob = async (retryId: string) => {
    const job = await redis.get(retryId);
    if (!job) {
        return null; // Job not found
    }

    const jobData = JSON.parse(job);

    let descriptionBatch: BookData[] | null = null;
    let summarizedBatch: BookData[] | null = null;

    if(jobData.failedStep === "fetchDescription") {
        // Get batch list of books and recall `await Promise.all(batch.map(fetchBookDescription))`
        const browser = await getBrowserInstance();
        const context = await browser.newContext(devices["Desktop Chrome"]);
        const descriptionBookFn = fetchBookDescription(context);

        try {
            const batch: BookData[] = jobData.books;
            descriptionBatch = await Promise.all(batch.map(descriptionBookFn));
            summarizedBatch = await summarizeBooksWithRelevance(descriptionBatch, jobData.theme);
            if (summarizedBatch && summarizedBatch.length > 0) { await pushToMakeWebHook(summarizedBatch, WEBHOOK_URL); }

        } catch (error) {
            if(summarizedBatch) {
                // If we have a summarized batch, mark the job as failed
                jobData.books = summarizedBatch;
                jobData.failedStep = "pushToMakeWebHook";
                await redis.set(retryId, JSON.stringify(jobData));
            }

            if(!summarizedBatch && descriptionBatch) {
                // If we have a description batch, mark the job as failed
                jobData.books = descriptionBatch;
                jobData.failedStep = "summarizeBook";
                await redis.set(retryId, JSON.stringify(jobData));
            }

            await context.close();

            throw new Error("An error occurred while processing the batch of books.");
        }

    }

    if(jobData.failedStep === "summarizeBook") {
        try {
            summarizedBatch = await summarizeBooksWithRelevance(jobData.books, jobData.theme);
            if (summarizedBatch && summarizedBatch.length > 0) { await pushToMakeWebHook(summarizedBatch, WEBHOOK_URL); }
        } catch (error) {
            if(summarizedBatch) {
                // If we have a summarized batch, mark the job as failed
                jobData.books = summarizedBatch;
                jobData.failedStep = "pushToMakeWebHook";
                await redis.set(retryId, JSON.stringify(jobData));
            }
            throw new Error("An error occurred while summarizing the batch of books.");
        }
    }

    if(jobData.failedStep === "pushToMakeWebHook") {
        try {
            await pushToMakeWebHook(jobData.books, WEBHOOK_URL);
        }
        catch (error) {
            // If we have a books batch, mark the job as failed
            jobData.failedStep = "pushToMakeWebHook";
            await redis.set(retryId, JSON.stringify(jobData));
            throw new Error("An error occurred while pushing to Make webhook.");
        }
    }

    return jobData;
}
