# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
# VITE_API_URL is a build-time variable baked into the JS bundle by Vite.
# Pass it via --build-arg to set the backend API URL for the compiled output.
# Leave empty to use same-origin requests (works with an upstream reverse proxy).
ARG VITE_API_URL=""
ENV VITE_API_URL="${VITE_API_URL}"
RUN npm run build

# Serve stage
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm /etc/nginx/conf.d/default.conf.bak 2>/dev/null || true

# Non-root
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
