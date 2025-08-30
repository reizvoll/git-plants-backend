FROM node:22-alpine

# Install pnpm
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile && pnpm approve-builds

COPY . .

RUN pnpm exec prisma generate

RUN pnpm run build

# Clean up dev dependencies after build
RUN pnpm prune --prod

EXPOSE $PORT

CMD ["pnpm", "start"]