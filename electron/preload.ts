import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('qortiumHome', {
  appName: 'Qortium Home',
});
