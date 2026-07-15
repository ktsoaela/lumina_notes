const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("luminaDesktop", {
  isDesktop: true,
  /** Chromium printToPDF — returns { ok, path? } or { ok:false, error } */
  exportPdf: (html, filename) =>
    ipcRenderer.invoke("lumina:export-pdf", { html, filename }),
});
