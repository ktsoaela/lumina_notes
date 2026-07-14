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
    LUMINA_ENV=production \
    SEED_DEMO_USER=0 \
    ENABLE_DOCS=0

# JWT_SECRET must be supplied at runtime (Compose / Kubernetes secret). Do not bake secrets into the image.

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 --shell /usr/sbin/nologin lumina \
    && mkdir -p /data \
    && chown -R lumina:lumina /app /data

COPY app.py run_api.py manage.py ./
COPY lumina ./lumina
COPY core ./core
COPY --from=frontend /app/dist ./dist

RUN chown -R lumina:lumina /app

USER lumina

EXPOSE 58888

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','58888')+'/health', timeout=3)"

CMD ["sh", "-c", "python -m uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
