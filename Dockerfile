FROM node:20-alpine

WORKDIR /app

# Install backend dependencies first for layer caching
COPY backend/package*.json ./backend/
RUN npm --prefix backend ci --omit=dev

# Copy application code
COPY backend ./backend
COPY package.json ./

WORKDIR /app/backend

EXPOSE 5000

# The app reads PORT from the environment; server.js binds it.
CMD ["node", "server.js"]