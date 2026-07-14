# syntax=docker/dockerfile:1

FROM node:22-bookworm AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json metadata.json ./
COPY src ./src
RUN npm run build

FROM python:3.12-slim-bookworm AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=58888 \
    JWT_SECRET=change-me-in-production

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py run_api.py manage.py ./
COPY lumina ./lumina
COPY core ./core
COPY --from=frontend /app/dist ./dist

EXPOSE 58888

CMD ["sh", "-c", "python -m uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
