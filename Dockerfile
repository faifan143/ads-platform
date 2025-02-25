FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/

RUN npx prisma generate

COPY tsconfig*.json ./  

COPY . .

RUN npm run build


EXPOSE 3001

CMD ["npm", "run", "start:prod"]