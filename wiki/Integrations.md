# Integrations

This repository is wired for common GitHub integrations.

## GitHub Actions (CI/CD)

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

On push/PR to `main` / `master` / `dev`:

1. Frontend install, TypeScript check, production build
2. Python dependency install and API import check
3. On push: Docker image build

## Dependabot

Config: [`.github/dependabot.yml`](../.github/dependabot.yml)

Weekly updates for npm, pip, and GitHub Actions.

## Wiki

1. Repo **Settings → General → Features → Wikis** — enable.
2. Clone the wiki remote:

   ```bash
   git clone https://github.com/fullyoperational/lumina_notes.wiki.git
   ```

3. Copy Markdown from this repo’s `wiki/` folder into the wiki clone (use `Home.md` as the home page).
4. Commit and push to publish.

## About / topics

Suggested repository **About** description:

```text
simple_markdown_notebook_application
```

Suggested topics: `markdown`, `notes`, `fastapi`, `react`, `electron`, `kubernetes`.
