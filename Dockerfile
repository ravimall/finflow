
FROM node:18-alpine
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --production
COPY backend/ ./
EXPOSE 5000
CMD ["node", "src/app.js"]
