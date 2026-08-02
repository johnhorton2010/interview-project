FROM node:24-alpine AS builder
WORKDIR /app

# Copy dependency files first to leverage Docker caching
COPY package*.json ./
RUN npm ci

# Copy the rest of your application code
COPY . .

# The repo-root .env is outside this build context, so the prefix arrives as a build arg
# and vite.config.js reads it off the environment. Declared after npm ci so changing it
# doesn't invalidate the dependency layer.
ARG APP_API_PREFIX=/api/v1
ENV APP_API_PREFIX=${APP_API_PREFIX}

# Build the application (produces the /dist folder)
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Replaces the stock default server: adds the API proxy and the SPA fallback.
# Lands in templates/ so the image's entrypoint runs envsubst over it at startup,
# which is what makes the upstream host and API prefix configurable without a rebuild.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]