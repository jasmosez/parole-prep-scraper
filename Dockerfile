FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Container runs on port 8080
EXPOSE 8080

# Start the server
CMD [ "node", "index.js" ] 