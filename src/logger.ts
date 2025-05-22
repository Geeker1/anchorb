import app from "./handlers";

// Reuse fastify logger, since output is json by default
export const logger = app.log;