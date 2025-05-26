
import { BookData } from "../types";
import OpenAI from "openai";
import { logger } from "../logger";
import { OPENAI_KEY, GPT_MODEL } from "../constants";


const buildBookDescriptionsString = (books: BookData[]): string =>
    books.map((book, idx) => `${idx + 1}. ${book.description}\n`).join("");

export const summarizeBooksWithRelevance = async (
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