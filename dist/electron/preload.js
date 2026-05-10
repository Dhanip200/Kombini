"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    createTab: (url) => electron_1.ipcRenderer.invoke('tab:create', url),
    switchTab: (id) => electron_1.ipcRenderer.invoke('tab:switch', id),
    closeTab: (id) => electron_1.ipcRenderer.invoke('tab:close', id),
    navigateTab: (id, url) => electron_1.ipcRenderer.invoke('tab:navigate', { id, url }),
    extractContent: (id) => electron_1.ipcRenderer.invoke('tab:extract', id),
    clickElement: (id, agentId) => electron_1.ipcRenderer.invoke('tab:click', { id, agentId }),
    typeInto: (id, agentId, text) => electron_1.ipcRenderer.invoke('tab:type', { id, agentId, text }),
    scrollPage: (id, direction) => electron_1.ipcRenderer.invoke('tab:scroll', { id, direction }),
    pressKey: (id, key) => electron_1.ipcRenderer.invoke('tab:press-key', { id, key }),
    getSimplifiedDom: (id) => electron_1.ipcRenderer.invoke('tab:get-simplified-dom', id),
    scrapePage: (tabId, query) => electron_1.ipcRenderer.invoke('tab:scrape', { id: tabId, query }),
    takeScreenshot: (id) => electron_1.ipcRenderer.invoke('tab:screenshot', id),
    waitForIdle: (id) => electron_1.ipcRenderer.invoke('tab:wait-for-idle', id),
    onTabUpdated: (callback) => {
        electron_1.ipcRenderer.on('tab:updated', (event, data) => callback(data));
    },
});
