# Website Downloader — Express + Socket.io server that shells out to `wget`
# to mirror a site, then zips it with `archiver`. Needs a persistent host
# (Render, Railway, Fly, …) — it is NOT serverless-compatible.

FROM node:20-bookworm-slim

# wget is required at runtime to mirror sites; ca-certificates for HTTPS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy the application source.
COPY . .

# The archiver writes finished zips here; make sure the folder exists.
RUN mkdir -p public/sites

# Render injects PORT at runtime; bin/www reads process.env.PORT (default 3000).
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
