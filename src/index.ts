
import { NUM_WORKERS } from "./constants";
import "./events";
import { Worker } from "bullmq";
import app from "./handlers";
import { startWorker } from './worker/worker';


let WORKERS: Worker[] = [];

// Graceful shutdown
const shutdown = async () => {
  app.log.info("Shutting down workers...");
  await Promise.all(WORKERS.map(worker => worker.close(true)));
};

const runServer = async () => {
  try {
    await app.listen({ host: "0.0.0.0", port: 3000 });
    WORKERS = await startWorker(NUM_WORKERS);

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

runServer();
