FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN npm --prefix backend ci --omit=dev \
 && npm --prefix frontend ci

COPY backend ./backend
COPY frontend ./frontend

# Build the SPA so Express can serve it from the same origin.
RUN npm run build

ENV NODE_ENV=production
ENV FRONTEND_DIST=/app/frontend/dist

WORKDIR /app/backend

EXPOSE 5000

# The app reads PORT from the environment; server.js binds it.
CMD ["node", "server.js"]
