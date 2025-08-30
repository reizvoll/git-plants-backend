FROM node:22-alpine

# Install pnpm
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

COPY . .

RUN pnpm run build

EXPOSE $PORT

CMD ["pnpm", "start"]