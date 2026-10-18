# syntax=docker/dockerfile:1
# Static image of mailcowui-ng (research R29): a non-root, read-only nginx serving the build under
# /ng/. Build from the repository root: docker build -f docker/Dockerfile .

FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
# Source maps are built hidden for error reporting and never shipped.
RUN npm run build && find dist -name '*.map' -delete

FROM nginxinc/nginx-unprivileged:1.28-alpine@sha256:7377697a821c131a924a7105fafbe7414db4e9fcc77a6f08f776f33f141ec3f8
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/ng/
EXPOSE 8080
