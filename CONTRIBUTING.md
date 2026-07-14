# Contributing to Lumina Notes

Thanks for contributing. This project is maintained by [Khotso Tsoaela](https://github.com/ktsoaela) (`@ktsoaela`).

## Ways to help

- Report bugs and propose features via GitHub Issues
- Improve docs (README, Wiki, CHANGELOG)
- Submit pull requests for fixes and enhancements

## Development setup

1. Fork and clone the repository.
2. Install dependencies:

   ```bash
   npm install
   pip install -r requirements.txt
   ```

3. Copy `.env.example` and set `JWT_SECRET` (and `GEMINI_API_KEY` if needed).
4. Run the stack:

   ```bash
   npm start
   ```

   Or frontend only: `npm run dev`.

5. Typecheck before opening a PR:

   ```bash
   npm run lint
   ```

## Branch and PR guidelines

- Base feature work on `dev` unless maintainers say otherwise.
- Keep PRs focused; one concern per PR when practical.
- Update `CHANGELOG.md` under `[Unreleased]` for user-visible changes.
- Do not commit secrets (`.env`, API keys, local `database.sqlite` with personal data).

## Code style

- TypeScript/React: match existing patterns in `src/`.
- Python (FastAPI/Django): match existing style in `app.py` and `lumina/`.
- Prefer clear, minimal changes over drive-by refactors.

## CI/CD

Pull requests run [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

- Node install + TypeScript check (`npm run lint`)
- Frontend production build (`npm run build`)
- Python dependency install

Fix CI failures locally before requesting review.

## Kubernetes / Docker

- Build image: `docker build -t lumina-notes .`
- Apply cluster manifests: `kubectl apply -f k8s/`
- See `wiki/Kubernetes.md` for notes.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
