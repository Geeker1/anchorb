
import Fastify, { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { JobPayload, PostBody, ReqParams } from './types';
import { anchorQueue, redis } from './queue';
import { EVENT_PREFIX } from './events';


const app = Fastify({logger: { level: "info" }});

async function getJobData(jobId: string): Promise<JobPayload | null> {
    const result = await redis.get(`${EVENT_PREFIX}-${jobId}`);
    return result ? (JSON.parse(result) as JobPayload) : null;
}


app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  request.log.error(error);
  reply.status(500).send({ error: 'Internal Server Error' });
});

app.post("/scrape", async (request, reply) => {
    const { theme } = request.body as PostBody;
    if(!theme){
        reply.code(401).send({ error: "`theme` key not passed in payload." });
        return;
    }
    const job = await anchorQueue.add('scrape', { search: theme });
    return { jobId: job.id }
})


app.get("/status/:jobId", async (request, reply) => {
    const { jobId } = request.params as ReqParams;
    const data = await getJobData(jobId);

    if (!data) {
        reply.code(404).send({ error: 'Job not found' })
        return;
    }

    return { status: data.status }
});

app.get("/results/:jobId", async (request, reply) => {
    const { jobId } = request.params as ReqParams;
    const data = await getJobData(jobId);

    if (!data) {
        reply.code(404).send({ error: 'Results for job not found.' })
        return;
    }

    return { ...data }
})

export default app;
