const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pdfApi', {
  openPdfDialog: () => ipcRenderer.invoke('open-pdf-dialog'),
  loadPdf: (filePath) => ipcRenderer.invoke('load-pdf', filePath),
  appendPdf: (filePath) => ipcRenderer.invoke('append-pdf', filePath),
  removePage: (pageIndex) => ipcRenderer.invoke('remove-page', pageIndex),
  movePage: (fromIndex, toIndex) => ipcRenderer.invoke('move-page', fromIndex, toIndex),
  savePdfAs: () => ipcRenderer.invoke('save-pdf-as'),
});