/**
 * The preload script runs before `index.html` is loaded
 * in the renderer. It has access to web APIs as well as
 * Electron's renderer process modules and some polyfilled
 * Node.js functions.
 *
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */
const { contextBridge, ipcRenderer } = require('electron')

// 暴露API给渲染进程
contextBridge.exposeInMainWorld('electron', {
  saveImage: (options) => ipcRenderer.invoke('save-image', options),
  saveJSON: (options) => ipcRenderer.invoke('save-json', options),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  startMonitor: (options) => ipcRenderer.invoke('start-monitor', options),
  stopMonitor: () => ipcRenderer.invoke('stop-monitor'),
  getFileList: (path) => ipcRenderer.invoke('get-file-list', path),
  openFile: (path) => ipcRenderer.invoke('open-file', path),
  showInFolder: (path) => ipcRenderer.invoke('show-in-folder', path),
  selectFolder: () => ipcRenderer.invoke('select-folder')
})

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
})
