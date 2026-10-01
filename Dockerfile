# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.19.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Next.js"

# Next.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Public URLs are also read during Next.js compilation for metadata and links.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY}
ARG NEXT_PUBLIC_GTM_ID
ENV NEXT_PUBLIC_GTM_ID=${NEXT_PUBLIC_GTM_ID}
ARG ROBOTS_ALLOW_INDEXING=false
ENV ROBOTS_ALLOW_INDEXING=${ROBOTS_ALLOW_INDEXING}

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev

# Copy application code
COPY . .

# Build application
RUN npx next build --experimental-build-mode compile

# Remove development dependencies
RUN npm prune --omit=dev


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Commit this image was built from, reported by /api/health so the deploy
# pipeline can confirm which release is serving. Declared in this final stage
# only: the build stage never sees it, so a new SHA leaves the npm ci and
# next build layers cached.
ARG GIT_SHA
ENV GIT_SHA=${GIT_SHA}

# Entrypoint sets up the container. Started through node rather than run as an
# executable: git stores the script without an execute bit (Windows checkouts
# cannot record one), and a Linux checkout in CI keeps that mode, so the image
# would hold a script the kernel refuses to run. Deploys from Windows hid this
# because Docker marks every file in a Windows build context executable.
ENTRYPOINT [ "node", "/app/docker-entrypoint.mjs" ]

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "npm", "run", "start" ]
