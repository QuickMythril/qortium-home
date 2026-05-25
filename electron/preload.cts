const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

contextBridge.exposeInMainWorld('qortiumHome', {
  appName: 'Qortium Home',
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    loadWallet: () => ipcRenderer.invoke('accounts:loadWallet'),
    setActiveAccount: (accountId: string) =>
      ipcRenderer.invoke('accounts:setActiveAccount', accountId),
    unlockWallet: (accountId: string, password: string) =>
      ipcRenderer.invoke('accounts:unlockWallet', accountId, password),
    lockWallet: (accountId: string) => ipcRenderer.invoke('accounts:lockWallet', accountId),
  },
});
