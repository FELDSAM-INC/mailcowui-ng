# syntax=docker/dockerfile:1
# Static image of mailcowui-ng (research R29): a non-root, read-only nginx serving the build under
# /ng/. Build from the repository root: docker build -f docker/Dockerfile .

FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
ARG BUILDARCH
RUN --mount=type=cache,id=ui-npm-${BUILDARCH},target=/root/.npm npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig*.json ./
COPY src/ src/
COPY public/ public/
COPY docker/nginx/security-headers.conf docker/nginx/security-headers.conf
RUN npm run build

# Export the same dist used by browser tests and both native container builds in CI.
FROM scratch AS build-output
COPY --from=build /app/dist/ /

FROM nginxinc/nginx-unprivileged:1.30-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03 AS runtime
USER root
# Apply available Alpine security fixes even when the upstream image tag has not been rebuilt.
RUN apk upgrade --no-cache
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/security-headers.conf /etc/nginx/security-headers.conf
EXPOSE 8080

# CI downloads dist from the build job; neither platform recompiles the frontend.
FROM runtime AS prebuilt
# A read-only build mount keeps source maps out of every shipping image layer.
RUN --mount=type=bind,source=dist,target=/tmp/dist \
    mkdir -p /usr/share/nginx/html/ng \
    && cp -a /tmp/dist/. /usr/share/nginx/html/ng/ \
    && chmod -R u=rwX,go=rX /usr/share/nginx/html/ng \
    && find /usr/share/nginx/html/ng -name '*.map' -delete
USER 101

# Default target retains the standalone build-from-source interface.
FROM runtime AS production
RUN --mount=type=bind,from=build,source=/app/dist,target=/tmp/dist \
    mkdir -p /usr/share/nginx/html/ng \
    && cp -a /tmp/dist/. /usr/share/nginx/html/ng/ \
    && chmod -R u=rwX,go=rX /usr/share/nginx/html/ng \
    && find /usr/share/nginx/html/ng -name '*.map' -delete
USER 101
