# Project Overview

This project is a TypeScript-based automation agent designed to streamline book data collection and enrichment. It scrapes book information from BookDP.com.au using a thematic keyword, enhances the data with AI-generated summaries and relevance scores, calculates cost details, and sends the processed results to a productivity tool through Make.com integration.

## Screenshots & GoogleSheet Link

Please find attached in this repository, screenshots regarding make integration flow, OpenAI data logs regarding summary/relevance score and output sample.
Attached here is the [Google Sheet](https://docs.google.com/spreadsheets/d/1Qex5U988gVu8G4E5l66BHlsd2DljEFot4E3GEPFAVk4/edit?usp=sharing) link which Make.com pushes bulk data into.


## Running the Project Locally

1. **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <project-directory>
    ```

2. **Configure environment variables:**
    - Copy `.env.example` to `.env` and update values as needed.

3. **Start the application:**
    Ensure you have docker and docker-compose installed on your local system.
    From the terminal, run the following:
    ```bash
    docker compose up --build
    ```
    This instructs docker to fetch and build images related to the services defined in docker-compose.yaml file.
    After this, docker compose starts up services and you can access web application via port `3000`.
    NOTE: To run services in background, add the `-d` flag to the command above.

4. **Use Application:**
We have three endpoints

- a. POST /scrape
- b. GET /status/:jobId
- c. GET /results/:jobId

**Examples (using CURL)**:
```bash
# POST /scrape
curl -X POST http://localhost:3000/scrape -H "Content-Type: application/json" -d @examples/scrape.json # examples/scrape.json is defined in project.
```

```bash
# GET /status/:jobId
curl http://localhost:3000/status/18 # Assuming `18` is a job id.
```

```bash
# GET /results/:jobId
curl http://localhost:3000/results/18 # Assuming `18` is a job id.
```


## Architecture and Approach

To view the architecture diagram for this project, view [Architecture](./Architecture%20Diagram.png)

The project is structured into two main components:

- **Backend:** Implemented using Node.js with Fastify, handling API requests, business logic, and integration with external services.
- **Database:** Utilizes Redis for reliable and scalable data storage.

**Technologies and Frameworks:**
- Node.js and Fastify for the backend to ensure scalability and maintainability.
- Docker and Docker Compose for containerization and simplified local development.
- Redis as the primary database for fast, in-memory data storage and retrieval.
- BullMQ for scaling background job processing using Queues and Workers.
- OpenAI for parsing summaries from book descriptions and calculating relevance scores.

**Architectural Decisions:**
- Using Docker ensures consistent environments across development and production.
- Redis was chosen for its reliability, fast memory access, and compatibility with the project's data requirements.
- Fastify was picked due to it's simplicity and speed which meets the requirements of this project.
- BullMQ is used due to it's level of performance, ability to retry failed jobs and extra robust features.
- The architecture supports easy integration with external services, such as Make.com, via webhooks.

## Make.com Integration Setup

In order to integrate this application with make, all you need to do is create a scenario on your Make.com dashboard.
Add the following modules:
- **Webhook**: To receive requests from our application.
- **Iterator & Array Aggregator**: Selects a key from webhook's json data which represents the rows, 
parses this and feeds into productivity module (Google Sheets).
By default the key is `rows`.
- **Google Sheets (Bulk Add Rows)**: Receives bulk data from Array Aggregator and appends to the end of the sheet.

Ensure that make flow has this sequence
Webhook -> Iterator -> Array Aggregator -> Google Sheets

Next, add the webhook url to `WEBHOOK_URL` env variable defined in your .env file.

Note, to ensure workflow on make is smooth, it's advisable to run each module step by step, 
so Make automatically adds the keys from the data it receives and it's easy for you to select visually.

## Assumptions and Limitations

### Assumptions

- Redis is used as the database, and completed jobs are not removed. This allows results to be fetched at any time.
- Failed jobs are always retried, with retry logic and exponential backoff implemented.
- The application is expected to scale and handle scraping of multiple pages; therefore, batch processing is introduced.
- The application should return partial results even if some processing steps fail. This is reflected in the batch processing for fetching book descriptions and evaluating summaries/relevance scores via OpenAI.
- Since the application relies on Redis, the `depends_on` tag is added to the API service in the Docker Compose file to ensure proper service startup order.


### Limitations:
- Schema validation is not implemented. This was considered acceptable for this simple use case, as only a single key is passed in the payload.
- If you choose to run the application locally without Docker, you must manually export environment variables using a bash command such as `export $(cat .env | xargs)` before starting the application to ensure all required configuration is available.