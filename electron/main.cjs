const { app, BrowserWindow, dialog, nativeImage } = require("electron");
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

let mainWindow = null;
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
      if (stderr) console.error(stderr);
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
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
  };
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
    await mainWindow.loadURL("http://127.0.0.1:5173/?desktop=1");
  } else {
    await startBackend();
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      icon: windowIcon(),
      webPreferences: webPrefs(),
    });
    await mainWindow.loadURL(`${PROD_URL}?desktop=1`);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

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
