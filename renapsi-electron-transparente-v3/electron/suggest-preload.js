const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('suggestOverlay', {
  onRender: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('suggest:render', handler);
    return () => ipcRenderer.removeListener('suggest:render', handler);
  },
  onClear: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = () => callback();
    ipcRenderer.on('suggest:clear', handler);
    return () => ipcRenderer.removeListener('suggest:clear', handler);
  },
  reportMetrics: (metrics) => ipcRenderer.send('suggest:metrics', metrics),
  pick: (payload) => ipcRenderer.send('suggest:pick', payload)
});
