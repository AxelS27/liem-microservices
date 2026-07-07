import { app, dialog } from 'electron'
import { join, isAbsolute, dirname, basename } from 'path'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import YTDlpWrap from 'yt-dlp-wrap'
import ffbinaries from 'ffbinaries'

const YTDlpClass = YTDlpWrap.default || YTDlpWrap
const stripAnsi = (str) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')

class DownloaderManager {
  constructor() {
    this.binDir = join(app.getPath('userData'), 'bin')
    this.ytdlpPath = join(this.binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
    this.ffmpegPath = join(this.binDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
    this.activeController = null
    this.activeProcess = null
  }

  // Check if both yt-dlp and ffmpeg binaries are present
  checkBinaries() {
    return existsSync(this.ytdlpPath) && existsSync(this.ffmpegPath)
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
      console.error('Error finding actual file:', err)
    }

    return filePath
  }

  // Get individual status of binaries
  getBinariesStatus() {
    return {
      ytdlp: existsSync(this.ytdlpPath),
      ffmpeg: existsSync(this.ffmpegPath),
      ready: this.checkBinaries()
    }
  }

  // Install binaries dynamically
  async installBinaries(onProgress) {
    if (!existsSync(this.binDir)) {
      mkdirSync(this.binDir, { recursive: true })
    }

    // Step 1: Download yt-dlp
    if (!existsSync(this.ytdlpPath)) {
      onProgress({ status: 'Downloading yt-dlp...', percent: 10 })
      try {
        await YTDlpClass.downloadFromGithub(this.ytdlpPath)
      } catch (err) {
        console.error('Failed to download yt-dlp:', err)
        throw new Error(`Failed to download yt-dlp: ${err.message}`)
      }
    }

    onProgress({ status: 'Installing yt-dlp...', percent: 50 })

    // Step 2: Download ffmpeg
    if (!existsSync(this.ffmpegPath)) {
      onProgress({ status: 'Downloading FFmpeg...', percent: 60 })
      await new Promise((resolve, reject) => {
        ffbinaries.downloadBinaries(['ffmpeg'], { destination: this.binDir }, (err, data) => {
          if (err) {
            console.error('Failed to download FFmpeg:', err)
            return reject(new Error(`Failed to download FFmpeg: ${err.message}`))
          }
          resolve(data)
        })
      })
    }

    onProgress({ status: 'Ready!', percent: 100 })
    return this.getBinariesStatus()
  }

  // Helper to open folder selection dialog
  async selectFolder() {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  }

  // Get YouTube video info (metadata) without downloading
  async getVideoInfo(url) {
    if (!this.checkBinaries()) {
      throw new Error('Dependencies (yt-dlp or FFmpeg) are not installed.')
    }
    const ytDlp = new YTDlpClass(this.ytdlpPath)
    try {
      const info = await ytDlp.getVideoInfo([url, '--no-playlist'])
      return {
        title: info.title || 'Unknown Title',
        thumbnail: info.thumbnail || '',
        uploader: info.uploader || 'Unknown Channel',
        duration: info.duration || 0
      }
    } catch (err) {
      console.error('Failed to get video info:', err)
      throw new Error(err.message || 'Failed to extract video metadata.')
    }
  }

  // Start YouTube download
  async startDownload(url, format, quality, targetDir, onProgress) {
    if (!this.checkBinaries()) {
      throw new Error('Dependencies (yt-dlp or FFmpeg) are not installed.')
    }

    if (this.activeProcess) {
      throw new Error('Another download is already in progress.')
    }

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true })
    }

    this.activeController = new AbortController()
    const ytDlp = new YTDlpClass(this.ytdlpPath)

    // Pre-fetch metadata to get accurate video title and do file check
    let title = 'Fetching video info...'
    try {
      if (onProgress) {
        onProgress({ title, status: 'Fetching video metadata...', percent: 0 })
      }
      const info = await ytDlp.getVideoInfo([url, '--no-playlist'])
      if (info && info.title) {
        title = info.title
      }
    } catch (err) {
      console.error('Failed to get video info for download:', err)
    }

    // Check if the exact same video/audio already exists in targetDir
    const expectedExt = format
    const expectedBase = `${title} - ${quality}.${expectedExt}`
    const expectedPath = join(targetDir, expectedBase)
    const existingFile = this.findActualFile(expectedPath)

    if (existingFile && existsSync(existingFile)) {
      throw new Error(`Cannot download. File already exists: "${basename(existingFile)}"`)
    }

    const cleanFfmpegPath = this.ffmpegPath.replace(/\\/g, '/')
    const cleanOutputPath = join(targetDir, `%(title)s - ${quality}.%(ext)s`).replace(/\\/g, '/')

    const args = []

    const isAudio = ['mp3', 'm4a', 'wav', 'flac'].includes(format)

    if (isAudio) {
      args.push('-x', '--audio-format', format)
      if (['mp3', 'm4a'].includes(format)) {
        args.push('--audio-quality', quality ? quality.replace('kbps', 'K') : '320K')
      }
    } else {
      // Video formats (mp4, webm, mkv)
      let formatStr = `bv*[ext=${format}]+ba/b[ext=${format}]` // Default/Best
      
      if (format === 'mp4') {
        formatStr = 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]'
        if (quality === '1080p') {
          formatStr = 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]'
        } else if (quality === '720p') {
          formatStr = 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]'
        } else if (quality === '480p') {
          formatStr = 'bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4]'
        } else if (quality === '360p') {
          formatStr = 'bv*[height<=360][ext=mp4]+ba[ext=m4a]/b[height<=360][ext=mp4]'
        }
      } else if (format === 'webm') {
        if (quality === '1080p') {
          formatStr = 'bv*[height<=1080][ext=webm]+ba/b[height<=1080][ext=webm]'
        } else if (quality === '720p') {
          formatStr = 'bv*[height<=720][ext=webm]+ba/b[height<=720][ext=webm]'
        } else if (quality === '480p') {
          formatStr = 'bv*[height<=480][ext=webm]+ba/b[height<=480][ext=webm]'
        } else if (quality === '360p') {
          formatStr = 'bv*[height<=360][ext=webm]+ba/b[height<=360][ext=webm]'
        }
      } else if (format === 'mkv') {
        formatStr = 'bv+ba/b'
        if (quality === '1080p') {
          formatStr = 'bv*[height<=1080]+ba/b[height<=1080]'
        } else if (quality === '720p') {
          formatStr = 'bv*[height<=720]+ba/b[height<=720]'
        } else if (quality === '480p') {
          formatStr = 'bv*[height<=480]+ba/b[height<=480]'
        } else if (quality === '360p') {
          formatStr = 'bv*[height<=360]+ba/b[height<=360]'
        }
        args.push('--merge-output-format', 'mkv')
      }
      
      args.push('-f', formatStr)
    }

    // Common options
    args.push(
      '--ffmpeg-location', cleanFfmpegPath,
      '-o', cleanOutputPath,
      '--no-playlist',
      '--no-warnings',
      '--no-cache-dir',
      '--no-colors'
    )

    args.push(url)

    console.log('Running yt-dlp with args:', args.join(' '))

    return new Promise((resolve, reject) => {
      if (onProgress) {
        onProgress({ title, status: 'Starting download...', percent: 0 })
      }

      this.activeProcess = ytDlp.exec(args, { env: process.env }, this.activeController.signal)

      this.activeProcess.on('progress', (progress) => {
        onProgress({
          title,
          percent: progress.percent || 0,
          speed: progress.currentSpeed || '0 KiB/s',
          eta: progress.eta || 'Unknown',
          status: 'Downloading...'
        })
      })

      let finalFilePath = null

      this.activeProcess.on('ytDlpEvent', (eventType, eventData) => {
        // Strip ANSI colors and trim carriage returns/whitespaces
        const cleanData = stripAnsi(eventData).trim()

        // Parse destination filename if printed by yt-dlp
        let parsedPath = null
        const destMatch = cleanData.match(/Destination:\s*(.+)$/)
        if (destMatch) {
          parsedPath = destMatch[1].trim().replace(/^"/, '').replace(/"$/, '')
        } else {
          const mergeMatch = cleanData.match(/Merging formats into\s*["']?(.+?)["']?$/)
          if (mergeMatch) {
            parsedPath = mergeMatch[1].trim()
          } else {
            const existsMatch = cleanData.match(/(.+?)\s+has already been downloaded$/)
            if (existsMatch) {
              parsedPath = existsMatch[1].trim()
            }
          }
        }

        if (parsedPath) {
          finalFilePath = isAbsolute(parsedPath) ? parsedPath : join(targetDir, parsedPath)
        }

        if (eventData.toLowerCase().includes('merging') || eventData.toLowerCase().includes('ffmpeg')) {
          onProgress({ title, percent: 99, speed: 'Processing...', eta: 'A few seconds...', status: 'Merging audio and video...' })
        } else if (eventData.toLowerCase().includes('extracting') || eventData.toLowerCase().includes('audio')) {
          onProgress({ title, percent: 99, speed: 'Processing...', eta: 'A few seconds...', status: 'Extracting audio to MP3...' })
        }
      })

      this.activeProcess.on('error', (err) => {
        this._cleanup()
        if (err.message && err.message.includes('abort')) {
          reject(new Error('Download cancelled by user.'))
        } else {
          reject(err)
        }
      })

      this.activeProcess.on('close', (code) => {
        this._cleanup()
        if (code === 0) {
          const resolvedPath = this.findActualFile(finalFilePath)
          resolve({ success: true, title, filePath: resolvedPath })
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`))
        }
      })
    })
  }

  // Cancel any running download
  cancelDownload() {
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

export default new DownloaderManager()
