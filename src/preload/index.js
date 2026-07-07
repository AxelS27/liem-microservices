import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('liem', {
  rpc: {
    activate: (config) => ipcRenderer.invoke('rpc:activate', config),
    deactivate: () => ipcRenderer.invoke('rpc:deactivate'),
    status: () => ipcRenderer.invoke('rpc:status')
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (data) => ipcRenderer.invoke('config:set', data)
  },
  autostart: {
    get: () => ipcRenderer.invoke('autostart:get'),
    set: (enabled) => ipcRenderer.invoke('autostart:set', enabled)
  },
  downloader: {
    check: () => ipcRenderer.invoke('downloader:check'),
    install: () => ipcRenderer.invoke('downloader:install'),
    selectFolder: () => ipcRenderer.invoke('downloader:select-folder'),
    getInfo: (url) => ipcRenderer.invoke('downloader:get-info', url),
    start: (options) => ipcRenderer.invoke('downloader:start', options),
    cancel: () => ipcRenderer.invoke('downloader:cancel'),
    showFile: (filePath) => ipcRenderer.invoke('downloader:show-file', filePath),
    onInstallProgress: (callback) => {
      const listener = (event, data) => callback(data)
      ipcRenderer.on('downloader:install-progress', listener)
      return () => ipcRenderer.off('downloader:install-progress', listener)
    },
    onProgress: (callback) => {
      const listener = (event, data) => callback(data)
      ipcRenderer.on('downloader:progress', listener)
      return () => ipcRenderer.off('downloader:progress', listener)
    }
  },
  converter: {
    check: () => ipcRenderer.invoke('converter:check'),
    selectFile: () => ipcRenderer.invoke('converter:select-file'),
    start: (options) => ipcRenderer.invoke('converter:start', options),
    cancel: () => ipcRenderer.invoke('converter:cancel'),
    showFile: (filePath) => ipcRenderer.invoke('converter:show-file', filePath),
    onProgress: (callback) => {
      const listener = (event, data) => callback(data)
      ipcRenderer.on('converter:progress', listener)
      return () => ipcRenderer.off('converter:progress', listener)
    }
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    toggleDevTools: () => ipcRenderer.send('window:toggleDevTools'),
    quit: () => ipcRenderer.send('app:quit')
  }
})
