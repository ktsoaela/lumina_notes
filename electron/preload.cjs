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
});
