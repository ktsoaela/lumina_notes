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

## Print & PDF

On an open note, use **Print** (browser print dialog — choose a printer or **Microsoft Print to PDF**) or **PDF** to download an A4 PDF generated from the **rendered Markdown** preview. Very large pages or some embedded charts may not rasterize perfectly in PDF.

## Windows app (Start menu — no terminal to *use* it)

The desktop shell is **Electron**. The API and static UI are still **FastAPI + the built Vite `dist`** (bundled next to `LuminaApi.exe`).

After you install once, you open Lumina like any other program: **Start → Lumina Notes** (and optionally a desktop shortcut). You do **not** need Command Prompt or Cursor to run it day to day.

### If someone gave you the installer

1. Run the NSIS installer from **`release\electron\`** (name like **`Lumina Notes Setup 1.0.0.exe`** after you build it).
2. Finish the wizard. The app appears under **Settings → Apps** and in the **Start** menu.
3. Launch **Lumina Notes** from there anytime.

### Build the installer yourself (one-time, on your dev PC)

Requires: **Node.js**, **Python** (for PyInstaller; the script installs PyInstaller if needed).

1. In the project folder, run **`npm run build:installer`**  
   - or double-click **`scripts\build_installer.bat`** in File Explorer (same thing).
2. Install from **`release\electron\`** (the **`Lumina Notes Setup … .exe`** file).
3. From then on, use **Start → Lumina Notes** only.

Default data file: **`database.sqlite`** next to **`LuminaApi.exe`** inside the app’s **`resources\backend`** folder (per-user install).

### Portable / dev

- **Dev (Electron + Vite + API):** `npm run dev:electron` (starts FastAPI, Vite, and Electron together).
- **Backend-only test (no Electron):** `npm run build:desktop` → run **`release\LuminaApi\LuminaApi.exe`** (API serves the built SPA from `dist` in the bundle).

Optional: [Inno Setup 6](https://jrsoftware.org/isdl.php) can wrap **`release\electron\win-unpacked`** using **`installer\LuminaNotes.iss`** if you want a second packaging path; the primary Windows installer is **electron-builder** (NSIS).

### Login errors / `passlib` + bcrypt

The API uses the **`bcrypt`** package only. If you still see **`passlib`** in tracebacks or `(trapped) error reading bcrypt version`, remove the old dependency and restart the API:

```bash
pip uninstall passlib -y
```

Then stop and start **uvicorn** (or your `run_project` terminal) so it reloads `app.py`.

Notebook icon attribution: https://www.flaticon.com/free-icon/book_2015630