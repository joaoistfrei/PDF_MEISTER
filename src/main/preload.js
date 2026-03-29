const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pdfApi', {
  openPdfDialog: () => ipcRenderer.invoke('open-pdf-dialog'),
  loadPdf: (filePath) => ipcRenderer.invoke('load-pdf', filePath),
  appendPdf: (filePath) => ipcRenderer.invoke('append-pdf', filePath),
  removePage: (pageIndex) => ipcRenderer.invoke('remove-page', pageIndex),
  movePage: (fromIndex, toIndex) => ipcRenderer.invoke('move-page', fromIndex, toIndex),
  clearDoc: () => ipcRenderer.invoke('clear-doc'),
  savePdfAs: () => ipcRenderer.invoke('save-pdf-as'),
  openImageDialog: () => ipcRenderer.invoke('open-image-dialog'),
  selectOutputFolder: () => ipcRenderer.invoke('select-output-folder'),
  convertImages: (payload) => ipcRenderer.invoke('convert-images', payload),
  resizeImages: (payload) => ipcRenderer.invoke('resize-images', payload),
  cropImages: (payload) => ipcRenderer.invoke('crop-images', payload),
});