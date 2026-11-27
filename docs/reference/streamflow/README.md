# StreamFlow Development Setup

Follow these steps to get the StreamFlow development environment running.

## 1. Environment Setup

Copy the example environment file and fill in your local values.

```bash
cp .env.example .env
```

**Note:** Ensure `DATABASE_URL` uses the `db` hostname (e.g., `postgresql://user:pass@db:5432/streamflow`) since we are running everything inside the Docker network.

## 2. Spin Up Infrastructure

Build and start the containers in detached mode. This pulls the Postgres image and builds your API Gateway image.

```bash
docker compose up --build -d
```

## 3. Initialize Database Schema

Since we are not running Node/Prisma on the host machine, we execute the migration from within the running API container. This creates the tables in PostgreSQL and generates the Prisma Client types.

```bash
docker exec -it api npx prisma migrate dev --name init_schema
```

### Tip on Step 3
When you run the `docker exec` command, Prisma might require `prisma` or `ts-node` if they are not in your `package.json`. Ensure `api-gateway/package.json` includes `prisma` in the `devDependencies` so that the command works immediately inside the container.

### Why "init_schema"?
The `--name init_schema` flag creates a folder inside `api-gateway/prisma/migrations`. Because of the Docker Volume mapping (`./api-gateway:/app`), that folder will automatically appear on your local file system as soon as the container creates it. This allows the container to handle the environment while your local machine retains the source files.

## 4. Verify the Connection

Check the logs to ensure the API is connected to the database and listening for requests:

```bash
docker compose logs -f api
```

You can also visit [http://localhost:3000/health](http://localhost:3000/health) in your browser.
