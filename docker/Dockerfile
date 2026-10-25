# syntax=docker/dockerfile:1
# Static image of mailcowui-ng (research R29): a non-root, read-only nginx serving the build under
# /ng/. Build from the repository root: docker build -f docker/Dockerfile .

FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
# Source maps are built hidden for error reporting and never shipped.
RUN npm run build && find dist -name '*.map' -delete

FROM nginxinc/nginx-unprivileged:1.31-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e
USER root
# Apply available Alpine security fixes even when the upstream image tag has not been rebuilt.
RUN apk upgrade --no-cache
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/ng/
USER 101
EXPOSE 8080
