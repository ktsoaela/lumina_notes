# Getting Started

## Prerequisites

- Node.js LTS
- Python 3.11+
- Optional: Docker and kubectl for container / cluster workflows

## Install

```bash
npm install
pip install -r requirements.txt
cp .env.example .env.local
```

Set `JWT_SECRET` and optionally `GEMINI_API_KEY` in `.env.local`.

## Run

```bash
npm start          # API + Django + Vite
npm run dev        # Vite only
npm run dev:electron
```

Default ports: Vite `5173`, API `58888`, Django `8001`.

## Verify

```bash
npm run lint
npm run build
```
