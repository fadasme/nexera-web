FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG PUBLIC_SITE_URL=https://nexera.cl
ARG PUBLIC_SITE_NAME=Nexera
ARG PUBLIC_BUSINESS_EMAIL=contacto@nexera.cl
ARG PUBLIC_BUSINESS_PHONE="+56 9 5400 9251"
ARG PUBLIC_BUSINESS_WHATSAPP=56954009251
ARG PUBLIC_BUSINESS_STREET=
ARG PUBLIC_BUSINESS_CITY=Santiago
ARG PUBLIC_BUSINESS_REGION="Región Metropolitana"
ARG PUBLIC_BUSINESS_COUNTRY=CL
ARG PUBLIC_BUSINESS_SOCIAL=
ARG PUBLIC_ANALYTICS_PROVIDER=none
ARG PUBLIC_ANALYTICS_ID=
ARG PUBLIC_ANALYTICS_SRC=
ARG PUBLIC_CAPTCHA_PROVIDER=none
ARG PUBLIC_CAPTCHA_SITE_KEY=
ENV DEPLOY_TARGET=node
RUN npm run build:node

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 4321
CMD ["node", "--env-file-if-exists=/run/secrets/nexera.env", "dist/server/entry.mjs"]
