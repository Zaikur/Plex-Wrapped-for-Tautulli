# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies
RUN npm install express --production

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy server file
COPY server.js .

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 2025

# Start the Express server
CMD ["node", "server.js"]