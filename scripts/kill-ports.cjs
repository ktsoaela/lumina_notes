#!/usr/bin/env node
/**
 * Kill switch: free Lumina Notes ports + related Electron.
 * Ports: Vite 5173, API 58888, Django 8001, Vite preview 4173
 */
const { execSync } = require("child_process");
const path = require("path");

const PORTS = [5173, 58888, 8001, 4173];
const ROOT = path.resolve(__dirname, "..");

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    ...opts,
  });
}

function killPort(port) {
  try {
    if (process.platform === "win32") {
      const out = sh(`netstat -ano | findstr :${port}`);
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!/LISTENING/i.test(line)) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (/^\d+$/.test(pid) && pid !== "0") pids.add(pid);
      }
      if (!pids.size) {
        console.log(`:${port} free`);
        return;
      }
      for (const pid of pids) {
        try {
          sh(`taskkill /F /PID ${pid}`);
        } catch {
          /* ignore */
        }
      }
      console.log(`killed :${port} → ${[...pids].join(", ")}`);
      return;
    }

    let pids = "";
    try {
      pids = sh(`lsof -tiTCP:${port} -sTCP:LISTEN`).trim();
    } catch {
      console.log(`:${port} free`);
      return;
    }
    if (!pids) {
      console.log(`:${port} free`);
      return;
    }
    sh(`kill -9 ${pids.split(/\s+/).join(" ")}`);
    console.log(`killed :${port} → ${pids.replace(/\s+/g, ", ")}`);
  } catch {
    console.log(`:${port} free`);
  }
}

function killElectron() {
  try {
    if (process.platform === "win32") {
      // Only processes whose command line mentions this repo (best-effort)
      sh(
        `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='electron.exe'\\" | Where-Object { $_.CommandLine -like '*lumina-notes*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`
      );
    } else {
      try {
        sh(`pkill -f ${JSON.stringify(ROOT)} || true`, { shell: "/bin/bash" });
      } catch {
        /* ignore */
      }
      try {
        sh(`pkill -f "ELECTRON_DEV=1 electron" || true`, {
          shell: "/bin/bash",
        });
      } catch {
        /* ignore */
      }
    }
    console.log("electron: cleared (if any)");
  } catch {
    console.log("electron: none");
  }
}

console.log("Lumina kill switch");
for (const port of PORTS) killPort(port);
killElectron();
console.log("done");
