FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8545
CMD ["sh", "-c", "npx hardhat node --hostname 0.0.0.0 & sleep 5 && npx hardhat run scripts/deploy.js --network localhost && wait"]
