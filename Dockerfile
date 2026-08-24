FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY MyHome.html ./
RUN mkdir -p /data

EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server.js"]
