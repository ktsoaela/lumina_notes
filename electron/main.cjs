const { app, BrowserWindow, dialog, ipcMain, nativeImage, screen } = require("electron");
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
  return process.env.ELECTRON_DEV === "1";
}

function waitForServer(url, maxMs = 120000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryOnce() {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        req.destroy();
        if (Date.now() - start > maxMs) {
          reject(new Error(`Timeout waiting for ${url}`));
        } else {
          setTimeout(tryOnce, 300);
        }
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

function startBackend() {
  const exe = backendExePath();
  if (!fs.existsSync(exe)) {
    return Promise.reject(
      new Error(
        `Backend not found at:\n${exe}\n\nRebuild with npm run build:electron:app`
      )
    );
  }
  backendProc = spawn(exe, [], {
    cwd: path.dirname(exe),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
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
  return waitForServer(PROD_URL).catch((err) => {
    const detail = stderr.trim() ? `\n\nBackend output:\n${stderr.trim()}` : "";
    throw new Error(`${err.message}${detail}`);
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

function stickyEdgeFromBounds(bounds, area) {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const distLeft = cx - area.x;
  const distRight = area.x + area.width - cx;
  const distTop = cy - area.y;
  const distBottom = area.y + area.height - cy;
  const min = Math.min(distLeft, distRight, distTop, distBottom);
  if (min === distLeft) return "left";
  if (min === distRight) return "right";
  if (min === distTop) return "top";
  return "bottom";
}

function stickyPackSize(edge, mode = "pack") {
  if (mode === "writing") return STICKY_SIZES.writing;
  if (edge === "top" || edge === "bottom") return STICKY_SIZES["pack-horizontal"];
  return STICKY_SIZES.pack;
}

function snapStickyBounds(bounds, area, mode = "pack") {
  const edge = stickyEdgeFromBounds(bounds, area);
  const size = stickyPackSize(edge, mode);
  let x = bounds.x;
  let y = bounds.y;

  if (edge === "right") {
    x = area.x + area.width - size.width;
    y = Math.max(area.y, Math.min(bounds.y, area.y + area.height - size.height));
  } else if (edge === "left") {
    x = area.x;
    y = Math.max(area.y, Math.min(bounds.y, area.y + area.height - size.height));
  } else if (edge === "top") {
    y = area.y;
    x = Math.max(area.x, Math.min(bounds.x, area.x + area.width - size.width));
  } else {
    y = area.y + area.height - size.height;
    x = Math.max(area.x, Math.min(bounds.x, area.x + area.width - size.width));
  }

  return { x, y, width: size.width, height: size.height, edge };
}

let lastStickyEdge = "right";
let stickyMode = "pack";

function snapStickyWindow() {
  if (!stickyWindow || stickyWindow.isDestroyed() || stickyClamping) return;
  const current = stickyWindow.getBounds();
  const area = screen.getDisplayMatching(current).workArea;
  const next = snapStickyBounds(current, area, stickyMode);
  lastStickyEdge = next.edge;
  if (
    next.x === current.x &&
    next.y === current.y &&
    next.width === current.width &&
    next.height === current.height
  ) {
    return;
  }
  stickyClamping = true;
  stickyWindow.setBounds({
    x: next.x,
    y: next.y,
    width: next.width,
    height: next.height,
  });
  stickyClamping = false;
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
  stickyWindow.on("move", () => {
    snapStickyWindow();
  });
  stickyWindow.on("closed", () => {
    stickyWindow = null;
  });
  stickyWindow.once("ready-to-show", () => {
    if (!stickyWindow || stickyWindow.isDestroyed()) return;
    stickyWindow.show();
    applyStickyAlwaysOnTop(stickyWindow);
    stickyWindow.moveTop();
  });
  await stickyWindow.loadURL(appUrl("desktop=1&sticky=1"));
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
    await mainWindow.loadURL(appUrl("desktop=1"));
  } else {
    await startBackend();
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      icon: windowIcon(),
      webPreferences: webPrefs(),
    });
    await mainWindow.loadURL(appUrl("desktop=1"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (stickyWindow && !stickyWindow.isDestroyed()) {
      stickyWindow.close();
    }
  });

  await createStickyWindow();
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

app.whenReady().then(boot);

app.on("window-all-closed", () => {
  killBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  killBackend();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    boot();
  }
});
