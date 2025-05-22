
import "./events";

import app from "./handlers";
import { startWorker } from './worker/worker';


const runServer = async () => {
  try {
    await app.listen({ host: "0.0.0.0", port: 3000 });
    await startWorker();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

runServer();
