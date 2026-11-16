const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("luminaDesktop", {
  isDesktop: true,
  /** Chromium printToPDF — returns { ok, path? } or { ok:false, error } */
  exportPdf: (html, filename) =>
    ipcRenderer.invoke("lumina:export-pdf", { html, filename }),
  /** Resize sticky window: closed (tab) | peek | open */
  setStickyMode: (mode) => ipcRenderer.send("lumina:sticky-mode", mode),
  /** Re-clear Win11 white ghost behind transparent sticky chrome */
  refreshStickyChrome: () => ipcRenderer.send("lumina:sticky-refresh-chrome"),
  setStickyEdge: (edge) => ipcRenderer.send("lumina:sticky-set-edge", edge),
  openPageInMain: (nav) => ipcRenderer.send("lumina:sticky-open-page", nav),
  onOpenPage: (cb) => {
    const handler = (_event, nav) => cb(nav);
    ipcRenderer.on("lumina:open-page", handler);
    return () => ipcRenderer.removeListener("lumina:open-page", handler);
  },
  /** Live sync page content between main ↔ sticky (no queues — just IPC) */
  publishPageSync: (patch) => ipcRenderer.send("lumina:page-sync", patch),
  onPageSync: (cb) => {
    const handler = (_event, patch) => cb(patch);
    ipcRenderer.on("lumina:page-sync", handler);
    return () => ipcRenderer.removeListener("lumina:page-sync", handler);
  },
  /** Profile → sticky: `storage` events are unreliable across Electron windows on Windows */
  notifyStickyTargetChanged: () => ipcRenderer.send("lumina:sticky-target-changed"),
  onStickyTargetChanged: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("lumina:sticky-target-changed", handler);
    return () => ipcRenderer.removeListener("lumina:sticky-target-changed", handler);
  },
  /** { stickyEnabled, version, platform } */
  getDesktopPrefs: () => ipcRenderer.invoke("lumina:get-desktop-prefs"),
  setStickyEnabled: (enabled) => ipcRenderer.invoke("lumina:set-sticky-enabled", enabled),
  /** Download a GitHub release asset into Downloads/Lumina Notes updates */
  downloadUpdate: (asset) => ipcRenderer.invoke("lumina:download-update", asset),
  showUpdateFile: (filePath) => ipcRenderer.invoke("lumina:show-update", filePath),
  onUpdateProgress: (cb) => {
    const handler = (_event, p) => cb(p);
    ipcRenderer.on("lumina:update-progress", handler);
    return () => ipcRenderer.removeListener("lumina:update-progress", handler);
  },
  /** Tray → sticky: open one colour's note */
  onStickyOpenFilm: (cb) => {
    const handler = (_event, filmId) => cb(filmId);
    ipcRenderer.on("lumina:sticky-open-film", handler);
    return () => ipcRenderer.removeListener("lumina:sticky-open-film", handler);
  },
  /** Tray toggled strips — Profile updates its switch */
  onDesktopPrefsChanged: (cb) => {
    const handler = (_event, prefs) => cb(prefs);
    ipcRenderer.on("lumina:desktop-prefs-changed", handler);
    return () => ipcRenderer.removeListener("lumina:desktop-prefs-changed", handler);
  },
  onStickyEdge: (cb) => {
    const handler = (_event, edge) => cb(edge);
    ipcRenderer.on("lumina:sticky-edge", handler);
    return () => ipcRenderer.removeListener("lumina:sticky-edge", handler);
  },
});
