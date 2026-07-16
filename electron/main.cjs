const { app, BrowserWindow, dialog, ipcMain, nativeImage, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const http = require("http");

/** Same file as `src/assets` `defaultLogo` (book_colour_outline.png) */
function windowIcon() {
  const p = path.join(__dirname, "..", "src", "assets", "book_colour_outline.png");
  if (fs.existsSync(p)) {
    return nativeImage.createFromPath(p);
  }
  return undefined;
}

const API_PORT = process.env.PORT || "58888";
const PROD_URL = `http://127.0.0.1:${API_PORT}/`;
const STICKY_PACK_W = 150;
const STICKY_PACK_H = 280;
const STICKY_WRITE_W = 360;
const STICKY_WRITE_H = 520;

const STICKY_SIZES = {
  pack: { width: STICKY_PACK_W, height: STICKY_PACK_H },
  writing: { width: STICKY_WRITE_W, height: STICKY_WRITE_H },
};

let mainWindow = null;
let stickyWindow = null;
let backendProc = null;

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

function stickyBounds(mode = "pack") {
  const area = screen.getPrimaryDisplay().workArea;
  const size = STICKY_SIZES[mode] || STICKY_SIZES.pack;
  const y =
    stickyWindow && !stickyWindow.isDestroyed()
      ? stickyWindow.getBounds().y
      : area.y + Math.round((area.height - size.height) / 2);
  return {
    width: size.width,
    height: size.height,
    x: area.x + area.width - size.width - 12,
    y,
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
  const next = STICKY_SIZES[mode] ? mode : "pack";
  stickyWindow.setBounds(stickyBounds(next));
  // Win11 can drop always-on-top after setBounds — re-assert.
  if (process.platform === "win32") {
    applyStickyAlwaysOnTop(stickyWindow);
    stickyWindow.moveTop();
  }
});

ipcMain.on("lumina:sticky-open-page", (_event, nav) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("lumina:open-page", nav);
});

/** Profile saved sticky book target — forward to sticky window (Win storage events flake). */
ipcMain.on("lumina:sticky-target-changed", () => {
  if (!stickyWindow || stickyWindow.isDestroyed()) return;
  stickyWindow.webContents.send("lumina:sticky-target-changed");
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
