import { redis } from "../queue";
import { Worker } from "bullmq";
import { BrowserContext, chromium, devices, Page } from "playwright";
import { BookData } from "../types";
import OpenAI from "openai";
import pushToMakeWebHook from "./make";
import { logger } from "../logger";

import { BATCH_SIZE, OPENAI_KEY, WEBHOOK_URL, MAX_PAGE_NUMBER, GPT_MODEL } from "./constants";

const buildBookDescriptionsString = (books: BookData[]): string =>
    books.map((book, idx) => `${idx + 1}. ${book.description}\n`).join("");

const summarizeBooksWithRelevance = async (
    books: BookData[],
    theme: string
): Promise<BookData[]> => {
    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    const prompt = `You are a JSON API. Summarize each of the following product descriptions in 1-2 sentences and assign a relevance score (0-100) for how well each book matches the theme "${theme}".

Respond only with raw JSON. Do not include any markdown formatting or text outside the JSON.

Output format:
[
    {
        "summary": "...",
        "relevance_score": ...
    },
    ...
]

Here is the input:
${buildBookDescriptionsString(books)}`;

    try {
        const response = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
        });

        const raw = response?.choices[0]?.message?.content?.trim();
        const summaries: { summary: string; relevance_score: string }[] = JSON.parse(raw || "");

        logger.info(summaries);

        return books.map((book, idx) => {
            const relevanceScore = parseFloat(summaries[idx].relevance_score);
            const valueScore = Math.round((relevanceScore / book.currentPrice) * 100) / 100;
            return {
                ...book,
                summary: summaries[idx].summary,
                relevanceScore,
                valueScore,
            };
        });
    } catch {
        return books;
    }
};

const fetchBookDescription =
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
        const descriptionBatch = await Promise.all(batch.map(descriptionBookFn));
        const summarizedBatch = await summarizeBooksWithRelevance(descriptionBatch, theme);
        processedBooks = [...processedBooks, ...summarizedBatch];
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

const scrapeBooksBySearchTerm = async (searchTerm: string): Promise<BookData[]> => {
    const browser = await chromium.launch();
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

    await pushToMakeWebHook(processedBooks, WEBHOOK_URL);

    await context.close();
    await browser.close();

    return processedBooks;
};

export const startWorker = async () => {
    new Worker(
        "anchorb",
        async (job) => {
            return await scrapeBooksBySearchTerm(job.data.search);
        },
        { connection: redis }
    );
};
