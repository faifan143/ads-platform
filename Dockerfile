FROM node:20-alpine

WORKDIR /app

# Install necessary system packages
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

EXPOSE 3001

# Command to run the application
CMD ["npm", "run", "start:prod"]