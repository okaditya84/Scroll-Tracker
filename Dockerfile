# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files from server directory
COPY server/package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy server source code
COPY server/ ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').request('http://localhost:4000/health', {timeout: 2000}).end()"

# Start the application
CMD ["npm", "start"]
