# Multi-stage lightweight Node.js Dockerfile
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Asia/Kolkata

# Install timezone data
RUN apk add --no-cache tzdata

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code and frontend
COPY . .

# Expose server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
