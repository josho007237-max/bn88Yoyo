# syntax=docker/dockerfile:1

FROM node:18-bullseye-slim AS build
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:18-bullseye-slim AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y openssl ca-certificates postgresql-client && rm -rf /var/lib/apt/lists/*

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./

EXPOSE 8080
CMD ["node","--experimental-specifier-resolution=node","dist/server.js"]
