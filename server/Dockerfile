FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 4000

CMD ["sh", "-c", "npm run migrate && npm run seed && npm run serve"]
