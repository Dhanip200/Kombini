import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  createTab: (url?: string) => ipcRenderer.invoke('tab:create', url),
  switchTab: (id: string) => ipcRenderer.invoke('tab:switch', id),
  closeTab: (id: string) => ipcRenderer.invoke('tab:close', id),
  navigateTab: (id: string, url: string) => ipcRenderer.invoke('tab:navigate', { id, url }),
  extractContent: (id: string) => ipcRenderer.invoke('tab:extract', id),
  clickElement: (id: string, agentId: string) => ipcRenderer.invoke('tab:click', { id, agentId }),
  typeInto: (id: string, agentId: string, text: string) => ipcRenderer.invoke('tab:type', { id, agentId, text }),
  scrollPage: (id: string, direction: 'up' | 'down') => ipcRenderer.invoke('tab:scroll', { id, direction }),
  pressKey: (id: string, key: string) => ipcRenderer.invoke('tab:press-key', { id, key }),
  getSimplifiedDom: (id: string) => ipcRenderer.invoke('tab:get-simplified-dom', id),
  scrapePage: (tabId: string, query: string) => ipcRenderer.invoke('tab:scrape', { id: tabId, query }),
  takeScreenshot: (id: string) => ipcRenderer.invoke('tab:screenshot', id),
  waitForIdle: (id: string) => ipcRenderer.invoke('tab:wait-for-idle', id),

  onTabUpdated: (callback: (data: any) => void) => {
    ipcRenderer.on('tab:updated', (event, data) => callback(data));
  },
});
