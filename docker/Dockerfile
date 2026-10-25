# syntax=docker/dockerfile:1
# Static image of mailcowui-ng (research R29): a non-root, read-only nginx serving the build under
# /ng/. Build from the repository root: docker build -f docker/Dockerfile .

FROM node:26-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
# Source maps are built hidden for error reporting and never shipped.
RUN npm run build && find dist -name '*.map' -delete

FROM nginxinc/nginx-unprivileged:1.30-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
USER root
# Apply available Alpine security fixes even when the upstream image tag has not been rebuilt.
RUN apk upgrade --no-cache
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/ng/
USER 101
EXPOSE 8080
