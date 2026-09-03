FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY MyHome.html ./
COPY admin.html ./
COPY gym.html ./
COPY manifest.webmanifest ./
COPY sw.js ./
RUN mkdir -p /data

EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server.js"]
