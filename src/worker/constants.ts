
export const BATCH_SIZE = Number(process.env.BATCH_SIZE) ?? 4;
export const OPENAI_KEY: string = process.env.OPENAPI_KEY || "";
export const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://hook.eu2.make.com/v80gqvvygjmrf4y8pht7luo3o6dlfd3t";
export const MAX_PAGE_NUMBER = Number(process.env.MAX_PAGE_NUMBER) ?? 2;
export const GPT_MODEL: string = process.env.GPT_MODEL || "gpt-3.5-turbo";
