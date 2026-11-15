const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bowlingDesktop', {
  isDesktopApp: true,
  getDesktopInfo: () => ipcRenderer.invoke('desktop:get-info'),
  loadLastSaveFile: () => ipcRenderer.invoke('desktop:load-save'),
  quickSaveToCurrentFile: (jsonText) => ipcRenderer.invoke('desktop:quick-save', { jsonText }),
  clearLastSaveLink: () => ipcRenderer.invoke('desktop:clear-save-link'),
  saveNewLeagueFile: (jsonText, defaultFilename) =>
    ipcRenderer.invoke('desktop:save-backup-dated', { jsonText, defaultFilename }),
  attemptCloseWithSave: (jsonText) =>
    ipcRenderer.invoke('desktop:attempt-close-with-save', { jsonText }),
  pickNewSaveAndClose: (jsonText, defaultFilename) =>
    ipcRenderer.invoke('desktop:pick-new-save-and-close', { jsonText, defaultFilename }),
  forceCloseWithoutSaving: () => ipcRenderer.invoke('desktop:force-close-without-saving'),
  cancelClose: () => ipcRenderer.invoke('desktop:cancel-close'),
  installUpdateToProgramFolder: (payload) =>
    ipcRenderer.invoke('desktop:install-update-to-folder', payload),
  onRequestCloseSave: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('desktop:request-close-save', handler);
    return () => ipcRenderer.removeListener('desktop:request-close-save', handler);
  },
});
