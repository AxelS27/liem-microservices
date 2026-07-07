import { ipcMain, shell } from 'electron'
import { existsSync } from 'fs'
import converterManager from './manager.js'

export function registerConverterHandlers() {
  // Check if FFmpeg dependencies are ready
  ipcMain.handle('converter:check', () => {
    return {
      ready: converterManager.checkBinaries()
    }
  })

  // Select file dialog
  ipcMain.handle('converter:select-file', async () => {
    return await converterManager.selectFile()
  })

  // Start media conversion
  ipcMain.handle('converter:start', async (event, { inputPath, format }) => {
    try {
      const result = await converterManager.startConversion(
        inputPath,
        format,
        (progress) => {
          event.sender.send('converter:progress', progress)
        }
      )
      return { success: true, result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Cancel conversion
  ipcMain.handle('converter:cancel', () => {
    return converterManager.cancelConversion()
  })

  // Reveal output file in folder
  ipcMain.handle('converter:show-file', (_, filePath) => {
    console.log('converter:show-file called with path:', filePath)
    if (filePath && existsSync(filePath)) {
      console.log('File exists, opening in folder:', filePath)
      shell.showItemInFolder(filePath)
      return { success: true }
    }
    console.error('converter:show-file failed. File exists:', filePath ? existsSync(filePath) : false, 'path:', filePath)
    return { success: false, error: 'File not found' }
  })
}
