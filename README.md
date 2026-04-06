<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/17f0082a-e037-4d23-ab45-af434558cf61

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Windows installer (desktop app)

Builds a setup program you can run to install Lumina Notes under **Settings → Apps** (per-user install, no admin).

1. Install [Inno Setup 6](https://jrsoftware.org/isdl.php) (free; provides `ISCC.exe`).
2. From the project folder:
   - `npm run build:installer`  
   - or `.\scripts\build_installer.ps1`
3. Run **`release\installer\LuminaNotes-Setup-1.0.0.exe`**.  
   Default install location: `%LocalAppData%\Programs\Lumina Notes`.

Without Inno Setup, you can still use the portable folder from `npm run build:desktop` (`release\LuminaNotes\LuminaNotes.exe`).

### Login errors / `passlib` + bcrypt

The API uses the **`bcrypt`** package only. If you still see **`passlib`** in tracebacks or `(trapped) error reading bcrypt version`, remove the old dependency and restart the API:

```bash
pip uninstall passlib -y
```

Then stop and start **uvicorn** (or your `run_project` terminal) so it reloads `app.py`.

Notebook icon attribution: https://www.flaticon.com/free-icon/book_2015630