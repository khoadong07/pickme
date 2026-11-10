FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev 2>/dev/null || true
COPY . .
EXPOSE 3456
CMD ["node", "server.js"]
