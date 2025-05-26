import { BrowserContext, devices, Page } from "playwright";
import { BookData } from "../../types";
import { logger } from "../../logger";
import { BATCH_SIZE, MAX_PAGE_NUMBER } from "../../constants";
import { summarizeBooksWithRelevance } from "../llmSummary";
import { redis, retryQueue } from "../../queue";
import { handleWebhookPush } from "../webhook";
import { getBrowserInstance } from "../../browser";

export const fetchBookDescription =
    (context: BrowserContext) => async (book: BookData): Promise<BookData> => {
    try {
        const page = await context.newPage();
        await page.goto(book.productUrl);
        await page.waitForSelector(".woocommerce-tabs--description-content", {
            timeout: 15000,
        });

        const description = await page
            .locator(".woocommerce-tabs--description-content p")
            .innerText();

        await page.close();
        return { ...book, description };
    } catch {
        return { ...book };
    }
};

const processBooksInBatches = async (
    theme: string,
    context: BrowserContext,
    books: BookData[],
    batchSize: number = BATCH_SIZE,
    getBookDescription: (context: BrowserContext) => (book: BookData) => Promise<BookData>
): Promise<BookData[]> => {
    let processedBooks: BookData[] = [];
    const descriptionBookFn = getBookDescription(context);

    logger.info("Extracting Summary and Relevance by batch processing.")

    for (let i = 0; i < books.length; i += batchSize) {
        logger.info(`Processing batch ${i / batchSize + 1}`);
        const batch = books.slice(i, i + batchSize);

        let descriptionBatch: BookData[] | null = null;
        let summarizedBatch: BookData[] | null = null;

        try {
            descriptionBatch = await Promise.all(batch.map(descriptionBookFn));
            summarizedBatch = await summarizeBooksWithRelevance(descriptionBatch, theme);
            processedBooks = [...processedBooks, ...summarizedBatch];   
        } catch (error) {
            const retryId = `retry:job:${Date.now()}`;

            if(!summarizedBatch && descriptionBatch) {
                const jobData = {
                    books: descriptionBatch,
                    theme,
                    failedStep: "summarizeBook",
                    retryId
                };

                await redis.set(retryId, JSON.stringify(jobData));

                const job = await retryQueue.add(`scrape:${retryId}`, { retryId });
                logger.info(`Job ${job.id} added to retry queue for batch processing.`);
            }

            if(!descriptionBatch) {
                const jobData = {
                    books: batch,
                    theme,
                    failedStep: "fetchDescription",
                    retryId
                };

                // If we have a batch, mark the job as failed
                jobData.books = batch;
                jobData.failedStep = "fetchDescription";
                await redis.set(retryId, JSON.stringify(jobData));

                const job = await retryQueue.add(`scrape:${retryId}`, { retryId });
                logger.info(`Job ${job.id} added to retry queue for batch processing.`);
            }
        }
    }

    return processedBooks;
};

const extractBooksFromPage = async (
    pageNumber: number,
    page: Page,
    encodedSearch: string
): Promise<BookData[]> => {
    logger.info(`Processing page ${pageNumber}`);
    const books: BookData[] = [];

    await page.goto(
        `https://bookdp.com.au/page/${pageNumber}?s=${encodedSearch}&post_type=product`
    );
    await page.waitForSelector(".product-inner", { timeout: 15000 });

    const products = page.locator(".product-inner");
    const count = await products.count();
    logger.info(`Product count for page ${pageNumber} is ${count}`);

    for (let i = 0; i < count; i++) {
        const product = products.nth(i);
        const titleLocator = product.locator(".woocommerce-loop-product__title a");
        const originalPrice = await product
            .locator(".price del bdi")
            .first()
            .innerText();
        const currentPrice = await product
            .locator(".price ins bdi")
            .first()
            .innerText();

        const original = parseFloat(originalPrice.split("$")[1]);
        const current = parseFloat(currentPrice.split("$")[1]);
        const discountAmount = Math.round((original - current) * 100) / 100;
        const discountPercentage = Math.round(((discountAmount / original) * 100) * 100) / 100;

        books.push({
            title: await titleLocator.innerText(),
            author: "",
            currentPrice: current,
            originalPrice: original,
            discountAmount,
            discountPercentage,
            valueScore: 0,
            relevanceScore: 0,
            description: "",
            productUrl: (await titleLocator.getAttribute("href")) || "",
            summary: "",
        });
    }

    return books;
};

export const scrapeBooksBySearchTerm = async (searchTerm: string): Promise<BookData[]> => {
    const browser = await getBrowserInstance();
    const context = await browser.newContext(devices["Desktop Chrome"]);
    const page = await context.newPage();
    const encodedSearch = encodeURIComponent(searchTerm);

    let pageNumbers = [];
    for (let index = 0; index < MAX_PAGE_NUMBER; index++) {
        pageNumbers.push(index+1);
    }

    let allBooks: BookData[] = [];

    logger.info(`Scraping ${pageNumbers.length} pages.`);

    for (const pageNumber of pageNumbers) {
        try {
            const booksOnPage = await extractBooksFromPage(pageNumber, page, encodedSearch);
            allBooks = [...allBooks, ...booksOnPage];
        } catch (error: unknown) {
            logger.error(`[ERROR] Processing page ${pageNumber} failed. ${error}`);
        }
    }

    const processedBooks = await processBooksInBatches(
        searchTerm,
        context,
        allBooks,
        BATCH_SIZE,
        fetchBookDescription
    );

    await handleWebhookPush(processedBooks, searchTerm);

    await context.close();

    return processedBooks;
};
