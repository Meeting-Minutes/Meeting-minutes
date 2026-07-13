FROM oven/bun:1.3.14
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
USER bun
EXPOSE 3001
CMD ["bun", "run", "serve"]
