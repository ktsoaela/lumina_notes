const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("luminaDesktop", {
  isDesktop: true,
  /** Chromium printToPDF — returns { ok, path? } or { ok:false, error } */
  exportPdf: (html, filename) =>
    ipcRenderer.invoke("lumina:export-pdf", { html, filename }),
  /** Resize sticky window: closed (tab) | peek | open */
  setStickyMode: (mode) => ipcRenderer.send("lumina:sticky-mode", mode),
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
});
