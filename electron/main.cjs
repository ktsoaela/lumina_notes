const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, screen, shell, Tray } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const http = require("http");

/** Taskbar / window icon — colour mark without outline */
function windowIcon() {
  const p = path.join(
    __dirname,
    "..",
    "src",
    "assets",
    "book_colour_no_outline.png"
  );
  if (fs.existsSync(p)) {
    return nativeImage.createFromPath(p);
  }
  return undefined;
}

/* ---------- Desktop prefs (main-process readable, survives reloads) ---------- */

const DEFAULT_DESKTOP_PREFS = { stickyEnabled: true };

function prefsPath() {
  return path.join(app.getPath("userData"), "desktop-prefs.json");
}

function readDesktopPrefs() {
  try {
    const raw = JSON.parse(fs.readFileSync(prefsPath(), "utf8"));
    return { ...DEFAULT_DESKTOP_PREFS, ...raw };
  } catch {
    return { ...DEFAULT_DESKTOP_PREFS };
  }
}

function writeDesktopPrefs(patch) {
  const next = { ...readDesktopPrefs(), ...patch };
  try {
    fs.mkdirSync(path.dirname(prefsPath()), { recursive: true });
    fs.writeFileSync(prefsPath(), JSON.stringify(next, null, 2));
  } catch (err) {
    console.error("Could not save desktop prefs:", err);
  }
  return next;
}

const API_PORT = process.env.PORT || "58888";
const PROD_URL = `http://127.0.0.1:${API_PORT}/`;
const STICKY_PACK_W = 150;
const STICKY_PACK_H = 280;
const STICKY_PACK_H_HORIZ = 150;
const STICKY_PACK_W_HORIZ = 280;
const STICKY_WRITE_W = 360;
const STICKY_WRITE_H = 520;

const STICKY_SIZES = {
  pack: { width: STICKY_PACK_W, height: STICKY_PACK_H },
  "pack-horizontal": { width: STICKY_PACK_W_HORIZ, height: STICKY_PACK_H_HORIZ },
  writing: { width: STICKY_WRITE_W, height: STICKY_WRITE_H },
};

let mainWindow = null;
let stickyWindow = null;
let backendProc = null;
let stickyClamping = false;

function isDev() {
  // Packaged builds must never wait on Vite (:5173), even if ELECTRON_DEV leaked into the env.
  if (app.isPackaged) return false;
  return process.env.ELECTRON_DEV === "1";
}

function waitForServer(url, maxMs = 120000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function failOrRetry() {
      if (Date.now() - start > maxMs) {
        reject(new Error(`Timeout waiting for ${url}`));
      } else {
        setTimeout(tryOnce, 300);
      }
    }
    function tryOnce() {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      // Hung sockets never emit "error" — without this, startup can stall forever.
      req.setTimeout(2000, () => {
        req.destroy();
        failOrRetry();
      });
      req.on("error", () => {
        req.destroy();
        failOrRetry();
      });
    }
    tryOnce();
  });
}

function backendExePath() {
  const base = path.join(process.resourcesPath, "backend");
  if (process.platform === "win32") {
    return path.join(base, "LuminaApi.exe");
  }
  return path.join(base, "LuminaApi");
}

async function startBackend() {
  // Always open the UI on 127.0.0.1 — never browse http://0.0.0.0 (Chromium rejects it).
  // Bind may still be 0.0.0.0 so phones on Wi‑Fi can reach the same API.
  // Prefer an already-running API (run_api.py / previous instance) — avoids port fights.
  try {
    await waitForServer(PROD_URL, 8000);
    return;
  } catch {
    /* nothing listening yet — start the bundled API */
  }

  const exe = backendExePath();
  if (!fs.existsSync(exe)) {
    return Promise.reject(
      new Error(
        `Backend not found at:\n${exe}\n\nStart the API first:\n  set LUMINA_HOST=0.0.0.0&& python run_api.py\n\nOr rebuild with npm run build:electron:app`
      )
    );
  }
  // Opt-in LAN bind so Profile → Connect phone QR works over Wi‑Fi.
  // Override with LUMINA_HOST=127.0.0.1 to keep loopback-only.
  const luminaHost = process.env.LUMINA_HOST || "0.0.0.0";
  backendProc = spawn(exe, [], {
    cwd: path.dirname(exe),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(API_PORT),
      LUMINA_HOST: luminaHost,
    },
  });
  let stderr = "";
  backendProc.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > 2000) stderr = stderr.slice(-2000);
  });
  backendProc.on("error", (err) => {
    console.error("Failed to start backend:", err);
  });
  backendProc.on("exit", (code, signal) => {
    if (code && code !== 0) {
      console.error(`Backend exited code=${code} signal=${signal}`);
    }
  });
  // Short wait: if the port is already taken, the existing server still answers PROD_URL.
  return waitForServer(PROD_URL, 30000).catch((err) => {
    const detail = stderr.trim() ? `\n\nBackend output:\n${stderr.trim()}` : "";
    throw new Error(
      `${err.message}${detail}\n\nTip: keep python run_api.py running with LUMINA_HOST=0.0.0.0, then reopen Lumina Notes.`
    );
  });
}

function killBackend() {
  if (backendProc && !backendProc.killed) {
    try {
      backendProc.kill();
    } catch {
      /* ignore */
    }
    backendProc = null;
  }
}

function webPrefs() {
  return {
    preload: path.join(__dirname, "preload.cjs"),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
  };
}

function appUrl(query) {
  const q = query ? `?${query}` : "";
  if (isDev()) return `http://127.0.0.1:5173/${q}`;
  return `${PROD_URL}${q}`;
}

/** Vite/HMR and Win GPU races often surface as ERR_ABORTED on first load. */
async function loadAppUrl(win, query, attempts = 5) {
  const url = appUrl(query);
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      await win.loadURL(url);
      // Drop a saved sync URL of http://0.0.0.0 — Chromium cannot open that host.
      try {
        await win.webContents.executeJavaScript(`(() => {
          try {
            const k = 'lumina_sync_server';
            const v = localStorage.getItem(k) || '';
            if (/0\\.0\\.0\\.0|\\[::\\]|^::/i.test(v)) localStorage.removeItem(k);
          } catch (_) {}
        })()`);
      } catch {
        /* page may not be ready for storage yet */
      }
      return;
    } catch (err) {
      lastErr = err;
      const code = err && err.code;
      if (code !== "ERR_ABORTED" && code !== "ERR_FAILED") throw err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

function stickyEdgeFromBounds(bounds, area) {
  const dLeft = bounds.x - area.x;
  const dRight = area.x + area.width - (bounds.x + bounds.width);
  const dTop = bounds.y - area.y;
  const dBottom = area.y + area.height - (bounds.y + bounds.height);

  if (bounds.width > bounds.height) {
    return dTop <= dBottom ? "top" : "bottom";
  }

  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft) return "left";
  if (min === dRight) return "right";
  if (min === dTop) return "top";
  return "bottom";
}

function stickyPackSize(edge, mode = "pack") {
  if (mode === "writing") return STICKY_SIZES.writing;
  if (edge === "top" || edge === "bottom") return STICKY_SIZES["pack-horizontal"];
  return STICKY_SIZES.pack;
}

let lastStickyEdge = "right";
let stickyMode = "pack";
let stickyMoveFromSnap = false;

function snapStickyBounds(bounds, area, mode = "pack", forcedEdge = null) {
  const edge = forcedEdge || stickyEdgeFromBounds(bounds, area);
  const size = stickyPackSize(edge, mode);
  let x = bounds.x;
  let y = bounds.y;

  if (edge === "right") {
    x = area.x + area.width - size.width;
    y = forcedEdge
      ? area.y + Math.round((area.height - size.height) / 2)
      : Math.max(area.y, Math.min(bounds.y, area.y + area.height - size.height));
  } else if (edge === "left") {
    x = area.x;
    y = forcedEdge
      ? area.y + Math.round((area.height - size.height) / 2)
      : Math.max(area.y, Math.min(bounds.y, area.y + area.height - size.height));
  } else if (edge === "top") {
    y = area.y;
    x = forcedEdge
      ? area.x + Math.round((area.width - size.width) / 2)
      : Math.max(area.x, Math.min(bounds.x, area.x + area.width - size.width));
  } else {
    y = area.y + area.height - size.height;
    x = forcedEdge
      ? area.x + Math.round((area.width - size.width) / 2)
      : Math.max(area.x, Math.min(bounds.x, area.x + area.width - size.width));
  }

  return { x, y, width: size.width, height: size.height, edge };
}

/** Win11 DWM often paints opaque white over transparent sticky chrome after blur. */
function refreshStickyTransparency() {
  if (!stickyWindow || stickyWindow.isDestroyed()) return;
  stickyWindow.setBackgroundColor("#00000000");
  if (process.platform !== "win32") return;
  const current = stickyWindow.getBounds();
  stickyClamping = true;
  stickyMoveFromSnap = true;
  // 1px nudge forces DWM to recomposite transparency without a visible jump.
  stickyWindow.setBounds({
    x: current.x,
    y: current.y,
    width: current.width + 1,
    height: current.height,
  });
  stickyWindow.setBounds(current);
  stickyClamping = false;
  setTimeout(() => {
    stickyMoveFromSnap = false;
  }, 50);
  applyStickyAlwaysOnTop(stickyWindow);
}

function snapStickyWindow(forcedEdge = null) {
  if (!stickyWindow || stickyWindow.isDestroyed() || stickyClamping) return;
  // Profile/orientation snaps always use pack size (not writing editor size)
  const mode = forcedEdge ? "pack" : stickyMode;
  if (forcedEdge) stickyMode = "pack";
  const current = stickyWindow.getBounds();
  const area = screen.getDisplayMatching(current).workArea;
  const next = snapStickyBounds(current, area, mode, forcedEdge);
  lastStickyEdge = next.edge;
  const unchanged =
    next.x === current.x &&
    next.y === current.y &&
    next.width === current.width &&
    next.height === current.height;
  if (unchanged && !forcedEdge) {
    // Still refresh chrome — blur leaves a white bar when bounds don't change.
    refreshStickyTransparency();
    return;
  }

  stickyClamping = true;
  stickyMoveFromSnap = true;
  stickyWindow.setBounds({
    x: next.x,
    y: next.y,
    width: next.width,
    height: next.height,
  });
  stickyClamping = false;
  setTimeout(() => {
    stickyMoveFromSnap = false;
  }, 50);
  stickyWindow.setBackgroundColor("#00000000");
  stickyWindow.webContents.send("lumina:sticky-edge", lastStickyEdge);
}

function stickyBounds(mode = "pack") {
  stickyMode = mode;
  const area =
    stickyWindow && !stickyWindow.isDestroyed()
      ? screen.getDisplayMatching(stickyWindow.getBounds()).workArea
      : screen.getPrimaryDisplay().workArea;
  const seed =
    stickyWindow && !stickyWindow.isDestroyed()
      ? stickyWindow.getBounds()
      : {
          x: area.x + area.width - STICKY_PACK_W,
          y: area.y + Math.round((area.height - STICKY_PACK_H) / 2),
          width: STICKY_PACK_W,
          height: STICKY_PACK_H,
        };
  const snapped = snapStickyBounds(seed, area, mode);
  lastStickyEdge = snapped.edge;
  return {
    x: snapped.x,
    y: snapped.y,
    width: snapped.width,
    height: snapped.height,
  };
}

function applyStickyAlwaysOnTop(win) {
  // macOS: floating + all Spaces. Win11: screen-saver level stays above most apps;
  // hasShadow/roundedCorners with transparent often paint a black box on Windows.
  if (process.platform === "darwin") {
    win.setAlwaysOnTop(true, "floating");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    return;
  }
  if (process.platform === "win32") {
    win.setAlwaysOnTop(true, "screen-saver");
    return;
  }
  win.setAlwaysOnTop(true, "floating");
}

async function createStickyWindow() {
  if (stickyWindow && !stickyWindow.isDestroyed()) {
    stickyWindow.show();
    stickyWindow.focus();
    return;
  }
  const bounds = stickyBounds("pack");
  const isWin = process.platform === "win32";
  stickyWindow = new BrowserWindow({
    ...bounds,
    title: "",
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    // Shadow + rounded corners break true transparency on Windows DWM.
    hasShadow: !isWin,
    roundedCorners: !isWin,
    thickFrame: false,
    show: false,
    focusable: true,
    autoHideMenuBar: true,
    icon: windowIcon(),
    webPreferences: webPrefs(),
  });
  applyStickyAlwaysOnTop(stickyWindow);
  stickyWindow.on("moved", () => {
    if (stickyMoveFromSnap) return;
    snapStickyWindow();
    if (!stickyWindow || stickyWindow.isDestroyed()) return;
    stickyWindow.webContents.send("lumina:sticky-edge", lastStickyEdge);
  });
  // Clicking another app leaves a thick white bar on Win11 until the next resize.
  stickyWindow.on("blur", () => {
    refreshStickyTransparency();
  });
  stickyWindow.on("focus", () => {
    refreshStickyTransparency();
  });
  stickyWindow.on("closed", () => {
    stickyWindow = null;
  });
  stickyWindow.once("ready-to-show", () => {
    if (!stickyWindow || stickyWindow.isDestroyed()) return;
    stickyWindow.show();
    stickyWindow.setBackgroundColor("#00000000");
    applyStickyAlwaysOnTop(stickyWindow);
    stickyWindow.moveTop();
    stickyWindow.webContents.send("lumina:sticky-edge", lastStickyEdge);
  });
  await loadAppUrl(stickyWindow, "desktop=1&sticky=1");
  if (!stickyWindow.isDestroyed() && !stickyWindow.isVisible()) {
    stickyWindow.show();
    applyStickyAlwaysOnTop(stickyWindow);
    stickyWindow.moveTop();
  }
}

async function createWindow() {
  if (isDev()) {
    await waitForServer("http://127.0.0.1:5173/");
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      icon: windowIcon(),
      webPreferences: webPrefs(),
    });
    await loadAppUrl(mainWindow, "desktop=1");
  } else {
    await startBackend();
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      icon: windowIcon(),
      webPreferences: webPrefs(),
    });
    await loadAppUrl(mainWindow, "desktop=1");
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (stickyWindow && !stickyWindow.isDestroyed()) {
      stickyWindow.close();
    }
  });

  // Sticky is nice-to-have; don't kill the main app if Win transparency/GPU flakes.
  if (readDesktopPrefs().stickyEnabled) {
    try {
      await createStickyWindow();
    } catch (err) {
      console.error("Sticky window failed to start:", err);
    }
  }
}

/** Chromium printToPDF in a hidden window — same engine as Chrome. */
ipcMain.handle("lumina:export-pdf", async (_event, payload) => {
  const html = typeof payload?.html === "string" ? payload.html : "";
  let filename = String(payload?.filename || "note.pdf").replace(
    /[<>:"/\\|?*\x00-\x1f]/g,
    ""
  );
  if (!filename.toLowerCase().endsWith(".pdf")) filename += ".pdf";
  if (!html.trim()) {
    return { ok: false, error: "Empty document" };
  }

  const win = new BrowserWindow({
    show: false,
    width: 800,
    height: 1100,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  try {
    await win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    );
    await new Promise((r) => setTimeout(r, 400));
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      margins: { marginType: "default" },
    });

    const { canceled, filePath } = await dialog.showSaveDialog(
      mainWindow || win,
      {
        title: "Save PDF",
        defaultPath: filename,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      }
    );
    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }
    fs.writeFileSync(filePath, pdf);
    return { ok: true, path: filePath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
});

ipcMain.on("lumina:sticky-mode", (_event, mode) => {
  if (!stickyWindow || stickyWindow.isDestroyed()) return;
  stickyMode = STICKY_SIZES[mode] ? mode : "pack";
  snapStickyWindow();
  // Win11 can drop always-on-top after setBounds — re-assert.
  if (process.platform === "win32") {
    applyStickyAlwaysOnTop(stickyWindow);
    stickyWindow.moveTop();
    stickyWindow.setBackgroundColor("#00000000");
  }
});

ipcMain.on("lumina:sticky-refresh-chrome", () => {
  refreshStickyTransparency();
});

ipcMain.on("lumina:sticky-set-edge", async (_event, edge) => {
  if (!["left", "right", "top", "bottom"].includes(edge)) return;
  if (!readDesktopPrefs().stickyEnabled) return;
  if (!stickyWindow || stickyWindow.isDestroyed()) {
    await createStickyWindow();
  }
  if (!stickyWindow || stickyWindow.isDestroyed()) return;
  stickyWindow.show();
  snapStickyWindow(edge);
  if (process.platform === "win32") {
    applyStickyAlwaysOnTop(stickyWindow);
    stickyWindow.moveTop();
  }
});

ipcMain.on("lumina:sticky-open-page", async (_event, nav) => {
  try {
    let recreated = false;
    if (!mainWindow || mainWindow.isDestroyed()) {
      await createWindow();
      recreated = true;
    }
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    if (recreated || mainWindow.webContents.isLoading()) {
      await new Promise((resolve) => {
        const done = () => resolve();
        mainWindow.webContents.once("did-finish-load", done);
        setTimeout(done, 4000);
      });
    } else {
      await new Promise((r) => setTimeout(r, 30));
    }
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send("lumina:open-page", nav);
    }
  } catch (err) {
    console.error("sticky-open-page failed", err);
  }
});

/** Profile saved sticky book target — forward to sticky window (Win storage events flake). */
ipcMain.on("lumina:sticky-target-changed", () => {
  if (!stickyWindow || stickyWindow.isDestroyed()) return;
  stickyWindow.webContents.send("lumina:sticky-target-changed");
});

ipcMain.handle("lumina:get-desktop-prefs", () => ({
  ...readDesktopPrefs(),
  version: app.getVersion(),
  platform: process.platform,
}));

/** Turn the sticky strips on/off — opens or closes the window immediately. */
/** Turn strips on/off from Profile or the tray; keeps both in sync. */
async function setStickyEnabled(enabled) {
  const on = Boolean(enabled);
  writeDesktopPrefs({ stickyEnabled: on });
  if (on) {
    try {
      await createStickyWindow();
    } catch (err) {
      console.error("Sticky window failed to start:", err);
    }
  } else if (stickyWindow && !stickyWindow.isDestroyed()) {
    stickyWindow.close();
  }
  refreshTrayMenu();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("lumina:desktop-prefs-changed", readDesktopPrefs());
  }
  return { ok: true, stickyEnabled: on };
}

ipcMain.handle("lumina:set-sticky-enabled", (_event, enabled) => setStickyEnabled(enabled));

/* ---------- System tray (Windows “hidden icons”, macOS menu bar) ---------- */

const STICKY_FILMS = [
  { id: "pink", label: "Pink" },
  { id: "orange", label: "Orange" },
  { id: "yellow", label: "Yellow" },
  { id: "green", label: "Green" },
  { id: "blue", label: "Blue" },
];

let tray = null;

async function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    await createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/** Open one colour's note straight from the tray (turns strips on if needed). */
async function openStickyFilm(filmId) {
  if (!STICKY_FILMS.some((f) => f.id === filmId)) return;
  const fresh = !stickyWindow || stickyWindow.isDestroyed();
  if (!readDesktopPrefs().stickyEnabled) await setStickyEnabled(true);
  else if (fresh) await createStickyWindow();
  if (!stickyWindow || stickyWindow.isDestroyed()) return;
  if (fresh || stickyWindow.webContents.isLoading()) {
    await new Promise((resolve) => {
      stickyWindow.webContents.once("did-finish-load", resolve);
      setTimeout(resolve, 4000);
    });
  }
  stickyWindow.show();
  stickyWindow.focus();
  stickyWindow.webContents.send("lumina:sticky-open-film", filmId);
}

function buildTrayMenu() {
  const prefs = readDesktopPrefs();
  return Menu.buildFromTemplate([
    { label: "Open Lumina Notes", click: () => void showMainWindow() },
    { type: "separator" },
    {
      label: "Sticky notes",
      submenu: STICKY_FILMS.map((f) => ({
        label: `${f.label} note`,
        click: () => void openStickyFilm(f.id),
      })),
    },
    {
      label: "Show sticky note strips",
      type: "checkbox",
      checked: prefs.stickyEnabled !== false,
      click: (item) => void setStickyEnabled(item.checked),
    },
    { type: "separator" },
    { label: `Lumina Notes v${app.getVersion()}`, enabled: false },
    { label: "Quit Lumina Notes", click: () => app.quit() },
  ]);
}

function refreshTrayMenu() {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  if (tray && !tray.isDestroyed()) return;
  const base = windowIcon();
  if (!base) return;
  const size = process.platform === "darwin" ? 18 : 16;
  tray = new Tray(base.resize({ width: size, height: size, quality: "best" }));
  tray.setToolTip("Lumina Notes — sticky notes");
  tray.setContextMenu(buildTrayMenu());
  // Left-click: bring the strips forward (or switch them on); menu if already showing.
  tray.on("click", () => {
    if (stickyWindow && !stickyWindow.isDestroyed() && stickyWindow.isVisible()) {
      tray.popUpContextMenu();
      return;
    }
    void setStickyEnabled(true);
  });
}

/* ---------- In-app update download (GitHub release assets only) ---------- */

const UPDATE_URL_PREFIX = "https://github.com/ktsoaela/lumina_notes/releases/download/";
let updateDownload = null;

function sendUpdateProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("lumina:update-progress", payload);
  }
}

ipcMain.handle("lumina:download-update", async (_event, payload) => {
  const url = String(payload?.url || "");
  const name = path.basename(String(payload?.name || "")).replace(/[<>:"/\\|?*\x00-\x1f]/g, "");
  if (!url.startsWith(UPDATE_URL_PREFIX) || !name) {
    return { ok: false, error: "Not a Lumina release download" };
  }
  if (updateDownload) return updateDownload;
  const dir = path.join(app.getPath("downloads"), "Lumina Notes updates");
  const dest = path.join(dir, name);
  const tmp = `${dest}.part`;
  updateDownload = (async () => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const res = await net.fetch(url, { redirect: "follow" });
      if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
      const total = Number(res.headers.get("content-length") || payload?.size || 0);
      const out = fs.createWriteStream(tmp);
      const reader = res.body.getReader();
      let received = 0;
      let lastSent = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        if (!out.write(Buffer.from(value))) {
          await new Promise((r) => out.once("drain", r));
        }
        const now = Date.now();
        if (now - lastSent > 200) {
          lastSent = now;
          sendUpdateProgress({ received, total });
        }
      }
      await new Promise((resolve, reject) => {
        out.end((err) => (err ? reject(err) : resolve()));
      });
      fs.renameSync(tmp, dest);
      sendUpdateProgress({ received, total, done: true, path: dest });
      return { ok: true, path: dest };
    } catch (err) {
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        /* ignore */
      }
      const message = err instanceof Error ? err.message : String(err);
      sendUpdateProgress({ error: message });
      return { ok: false, error: message };
    } finally {
      updateDownload = null;
    }
  })();
  return updateDownload;
});

/** Reveal a downloaded update in the file manager (only inside our updates folder). */
ipcMain.handle("lumina:show-update", (_event, filePath) => {
  const dir = path.join(app.getPath("downloads"), "Lumina Notes updates");
  const p = path.resolve(String(filePath || ""));
  if (!p.startsWith(dir + path.sep) || !fs.existsSync(p)) return { ok: false };
  shell.showItemInFolder(p);
  return { ok: true };
});

/** Relay live page edits to the other window (main ↔ sticky). */
ipcMain.on("lumina:page-sync", (event, patch) => {
  const sender = event.sender;
  for (const win of [mainWindow, stickyWindow]) {
    if (win && !win.isDestroyed() && win.webContents !== sender) {
      win.webContents.send("lumina:page-sync", patch);
    }
  }
});

async function boot() {
  try {
    await createWindow();
    try {
      createTray();
    } catch (err) {
      console.error("Tray icon failed:", err);
    }
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox(
      "Lumina Notes failed to start",
      message || "Unknown error starting the local API."
    );
    app.quit();
  }
}

// Note links + release pages open in the system browser, never in an app window.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
});

app.whenReady().then(boot);

app.on("window-all-closed", () => {
  killBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  killBackend();
  if (tray && !tray.isDestroyed()) tray.destroy();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    boot();
  }
});
