const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    search1337x: (query) => ipcRenderer.invoke('search-1337x', query),
    isElectron: true
});
