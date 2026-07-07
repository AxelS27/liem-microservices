import { app, dialog } from 'electron'
import { join, dirname, basename, extname } from 'path'
import { existsSync, readdirSync } from 'fs'
import { spawn } from 'child_process'

class ConverterManager {
  constructor() {
    this.binDir = join(app.getPath('userData'), 'bin')
    this.ffmpegPath = join(this.binDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
    this.activeProcess = null
    this.activeController = null
  }

  // Check if FFmpeg is installed
  checkBinaries() {
    return existsSync(this.ffmpegPath)
  }

  // Resolve the actual file path on disk, matching normalized filenames
  findActualFile(filePath) {
    if (!filePath) return null
    if (existsSync(filePath)) return filePath

    try {
      const dir = dirname(filePath)
      const base = basename(filePath)
      
      if (!existsSync(dir)) return filePath

      const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '')
      const normalizedTarget = normalize(base)

      const files = readdirSync(dir)
      for (const file of files) {
        if (normalize(file) === normalizedTarget) {
          return join(dir, file)
        }
      }
    } catch (err) {
      console.error('Error finding actual file in converter:', err)
    }

    return filePath
  }

  // Retrieve media file duration using ffmpeg -i
  getDuration(filePath) {
    return new Promise((resolve, reject) => {
      if (!this.checkBinaries()) {
        return reject(new Error('FFmpeg is not installed. Please setup dependencies.'))
      }

      const ffmpeg = spawn(this.ffmpegPath, ['-i', filePath])
      let stderr = ''

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      ffmpeg.on('close', () => {
        // Find Duration line e.g., Duration: 00:01:23.45
        const match = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
        if (match) {
          const hours = parseInt(match[1])
          const minutes = parseInt(match[2])
          const seconds = parseInt(match[3])
          const ms = parseInt(match[4]) * 10
          const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000 + ms
          resolve(totalMs)
        } else {
          // If file is not supported or not media, ffmpeg might print other details
          resolve(null)
        }
      })

      ffmpeg.on('error', (err) => {
        reject(err)
      })
    })
  }

  // Handle browse file dialog
  async selectFile() {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Media Files', extensions: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'mp3', 'm4a', 'wav', 'flac', 'ogg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      return {
        path: filePath,
        name: basename(filePath),
        size: existsSync(filePath) ? require('fs').statSync(filePath).size : 0
      }
    }
    return null
  }

  // Start conversion process
  async startConversion(rawInputPath, outputFormat, onProgress) {
    if (!this.checkBinaries()) {
      throw new Error('FFmpeg engine is not installed. Please set it up via the Downloader first.')
    }

    if (this.activeProcess) {
      throw new Error('Another conversion process is already in progress.')
    }

    const inputPath = this.findActualFile(rawInputPath)

    if (!existsSync(inputPath)) {
      throw new Error(`Input file does not exist: "${inputPath}"`)
    }

    // Get input file details
    const dir = dirname(inputPath)
    const ext = extname(inputPath)
    const baseName = basename(inputPath, ext)
    
    // Generate output path (e.g. video_converted.mov)
    const outputName = `${baseName}_converted.${outputFormat.toLowerCase()}`
    const outputPath = join(dir, outputName)

    this.activeController = new AbortController()

    // 1. Fetch total duration
    const durationMs = await this.getDuration(inputPath)
    if (!durationMs) {
      throw new Error('Failed to retrieve file duration. The file might be corrupted or unsupported.')
    }

    // Normalize paths to forward slashes for FFmpeg/Windows compatibility
    const cleanInput = inputPath.replace(/\\/g, '/')
    const cleanOutput = outputPath.replace(/\\/g, '/')

    // 2. Spawn ffmpeg for conversion
    const args = ['-y', '-i', cleanInput, '-progress', '-', cleanOutput]
    console.log('Running FFmpeg conversion with args:', args.join(' '))

    return new Promise((resolve, reject) => {
      this.activeProcess = spawn(this.ffmpegPath, args, { 
        env: process.env,
        signal: this.activeController.signal 
      })

      this.activeProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n')
        for (const line of lines) {
          if (line.startsWith('out_time_ms=')) {
            const outTimeMs = parseInt(line.split('=')[1].trim())
            // Calculate progress (out_time_ms is in microseconds)
            const percent = Math.min(99.9, (outTimeMs / (durationMs * 1000)) * 100)
            
            // Extract speed and bitrate if possible (ffmpeg progress output has speed=)
            let speed = '1.0x'
            onProgress({
              percent,
              status: 'Converting...'
            })
          }
        }
      })

      // We can also parse stderr for errors or detailed logs
      let stderrLog = ''
      this.activeProcess.stderr.on('data', (data) => {
        stderrLog += data.toString()
      })

      this.activeProcess.on('error', (err) => {
        this._cleanup()
        if (err.name === 'AbortError' || (err.message && err.message.includes('abort'))) {
          reject(new Error('Conversion cancelled by user.'))
        } else {
          reject(err)
        }
      })

      this.activeProcess.on('close', (code) => {
        this._cleanup()
        if (code === 0) {
          resolve({ success: true, outputPath })
        } else {
          // If aborted, code is null or non-zero
          if (this.activeController?.signal.aborted) {
            reject(new Error('Conversion cancelled by user.'))
          } else {
            reject(new Error(`FFmpeg conversion failed. code: ${code}. error: ${stderrLog.slice(-200)}`))
          }
        }
      })
    })
  }

  // Cancel active conversion
  cancelConversion() {
    if (this.activeController) {
      this.activeController.abort()
      this._cleanup()
      return true
    }
    return false
  }

  _cleanup() {
    this.activeProcess = null
    this.activeController = null
  }
}

export default new ConverterManager()
