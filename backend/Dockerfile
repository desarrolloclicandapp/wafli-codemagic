# syntax=docker/dockerfile:1

FROM node:20-slim AS deps

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY vendor ./vendor
COPY scripts ./scripts
RUN npm ci --omit=dev

FROM node:20-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY docs ./docs

EXPOSE 80

# Runtime is selected by WA_RUNTIME_MODE:
# - api: accepts HTTP traffic
# - worker: runs background jobs with health HTTP only
# - combined: local/dev all-in-one
CMD ["node", "src/index.js"]
