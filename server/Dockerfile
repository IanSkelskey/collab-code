FROM node:20-slim

# Install JDK and Python for interactive code execution
RUN apt-get update && \
    apt-get install -y default-jdk-headless python3 python3-venv && \
    groupadd --system --gid 10001 collabexec && \
    useradd --system --uid 10001 --gid 10001 --create-home --home-dir /home/collabexec collabexec && \
    rm -rf /var/lib/apt/lists/* && \
    javac -version && java -version && python3 --version && python3 -m venv --help > /dev/null

ENV EXEC_SANDBOX_UID=10001
ENV EXEC_SANDBOX_GID=10001
ENV EXEC_REQUIRE_SANDBOX=1

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . ./

EXPOSE 4444

CMD ["node", "index.cjs"]
