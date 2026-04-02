FROM node:20-slim

# Install JDK and Python for interactive code execution
RUN apt-get update && \
    apt-get install -y default-jdk-headless python3 && \
    rm -rf /var/lib/apt/lists/* && \
    javac -version && java -version && python3 --version

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . ./

EXPOSE 4444

CMD ["node", "index.cjs"]
