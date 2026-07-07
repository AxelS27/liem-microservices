import { ipcMain, app, shell } from 'electron'
import { existsSync } from 'fs'
import downloaderManager from './manager.js'

export function registerDownloaderHandlers() {
  ipcMain.handle('downloader:check', () => {
    return {
      ...downloaderManager.getBinariesStatus(),
      defaultDownloads: app.getPath('downloads')
    }
  })

  ipcMain.handle('downloader:install', async (event) => {
    try {
      const status = await downloaderManager.installBinaries((progress) => {
        event.sender.send('downloader:install-progress', progress)
      })
      return { success: true, status }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('downloader:select-folder', async () => {
    return await downloaderManager.selectFolder()
  })

  ipcMain.handle('downloader:show-file', (_, filePath) => {
    console.log('downloader:show-file called with path:', filePath)
    if (filePath && existsSync(filePath)) {
      console.log('File exists, opening in folder:', filePath)
      shell.showItemInFolder(filePath)
      return { success: true }
    }
    console.error('downloader:show-file failed. File exists:', filePath ? existsSync(filePath) : false, 'path:', filePath)
    return { success: false, error: 'File not found' }
  })

  ipcMain.handle('downloader:get-info', async (_, url) => {
    try {
      const info = await downloaderManager.getVideoInfo(url)
      return { success: true, info }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('downloader:start', async (event, { url, format, quality, targetDir }) => {
    try {
      const result = await downloaderManager.startDownload(
        url,
        format,
        quality,
        targetDir,
        (progress) => {
          event.sender.send('downloader:progress', progress)
        }
      )
      return { success: true, result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('downloader:cancel', () => {
    const cancelled = downloaderManager.cancelDownload()
    return { success: cancelled }
  })
}
