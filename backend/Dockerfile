# Yaar backend — single-process Node server (Express + node-cron + Vertex).
# Runs TypeScript directly with tsx, matching `npm start`.
FROM node:20-slim

WORKDIR /app

# Install deps first for layer caching. Include dev deps: tsx (the runtime) and
# TypeScript live there.
COPY package*.json ./
RUN npm ci

# App source.
COPY . .

# Cloud Run injects PORT (default 8080); config.ts reads process.env.PORT.
ENV NODE_ENV=production
EXPOSE 8080

CMD ["npm", "start"]
