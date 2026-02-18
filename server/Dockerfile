FROM node:20-slim

# Install JDK for interactive Java compilation and execution
RUN apt-get update && \
    apt-get install -y --no-install-recommends default-jdk-headless && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . ./

EXPOSE 4444

CMD ["node", "index.cjs"]
