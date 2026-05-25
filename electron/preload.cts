const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

contextBridge.exposeInMainWorld('qortiumHome', {
  appName: 'Qortium Home',
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    selectWalletFile: () => ipcRenderer.invoke('accounts:selectWalletFile'),
    discardLoadedWallet: (token: string) => ipcRenderer.invoke('accounts:discardLoadedWallet', token),
    saveLoadedWallet: (token: string, name: string) =>
      ipcRenderer.invoke('accounts:saveLoadedWallet', token, name),
    createWallet: (name: string, password: string) =>
      ipcRenderer.invoke('accounts:createWallet', name, password),
    setActiveAccount: (accountId: string) =>
      ipcRenderer.invoke('accounts:setActiveAccount', accountId),
    unlockWallet: (accountId: string, password: string) =>
      ipcRenderer.invoke('accounts:unlockWallet', accountId, password),
    lockWallet: (accountId: string) => ipcRenderer.invoke('accounts:lockWallet', accountId),
    removeWallet: (accountId: string, password?: string) =>
      ipcRenderer.invoke('accounts:removeWallet', accountId, password),
  },
});
