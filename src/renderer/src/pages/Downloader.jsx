import { useState, useEffect } from 'react'

// Helper to extract YouTube video ID
const getYouTubeId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : null
}

// Helper to format duration in seconds to MM:SS
const formatDuration = (sec) => {
  if (!sec) return '0:00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const formattedS = s < 10 ? `0${s}` : s
  if (h > 0) {
    const formattedM = m < 10 ? `0${m}` : m
    return `${h}:${formattedM}:${formattedS}`
  }
  return `${m}:${formattedS}`
}

export default function Downloader() {
  // Binary installation states: 'checking' | 'missing' | 'installing' | 'ready'
  const [binariesState, setBinariesState] = useState('checking')
  const [installProgress, setInstallProgress] = useState({ status: '', percent: 0 })
  const [installError, setInstallError] = useState(null)

  // Form states
  const [url, setUrl] = useState('')
  const [formatType, setFormatType] = useState('video') // 'video' | 'audio'
  const [format, setFormat] = useState('mp4') // 'mp4' | 'mkv' | 'webm' | 'mp3' | 'm4a' | 'wav' | 'flac'
  const [quality, setQuality] = useState('1080p') // '1080p', '720p', etc. or '320kbps', '192kbps'
  const [targetDir, setTargetDir] = useState('')

  // Download states: 'idle' | 'starting' | 'downloading' | 'processing' | 'completed' | 'error'
  const [downloadState, setDownloadState] = useState('idle')
  const [downloadProgress, setDownloadProgress] = useState({
    title: '',
    percent: 0,
    speed: '',
    eta: '',
    status: ''
  })
  const [downloadError, setDownloadError] = useState(null)

  // Preview states
  const [videoInfo, setVideoInfo] = useState(null)
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [lastFetchedUrl, setLastFetchedUrl] = useState('')
  const [lastDownloadedFile, setLastDownloadedFile] = useState(null)

  // Helper to install the engine dependencies
  const installEngine = async () => {
    setBinariesState('installing')
    setInstallError(null)
    try {
      const res = await window.liem.downloader.install()
      if (res.success && res.status.ready) {
        setBinariesState('ready')
      } else {
        setBinariesState('missing')
        setInstallError(res.error || 'Failed to install engine dependencies.')
      }
    } catch (err) {
      setBinariesState('missing')
      setInstallError(err.message || 'An error occurred during installation.')
    }
  }

  // Initialize and check status
  useEffect(() => {
    window.liem.downloader.check().then((status) => {
      // Load saved download directory or use default path
      const savedDir = localStorage.getItem('downloader_target_dir')
      if (savedDir) {
        setTargetDir(savedDir)
      } else if (status.defaultDownloads) {
        setTargetDir(status.defaultDownloads)
      }

      if (status.ready) {
        setBinariesState('ready')
      } else {
        // Automatically start downloading binaries
        installEngine()
      }
    }).catch((err) => {
      console.error('Failed to check binaries status:', err)
      setBinariesState('missing')
    })
  }, [])

  // Fetch video details when URL matches a YouTube video
  useEffect(() => {
    const ytId = getYouTubeId(url)
    if (ytId && url !== lastFetchedUrl) {
      const timer = setTimeout(async () => {
        setLoadingInfo(true)
        setVideoInfo(null)
        setLastFetchedUrl(url)
        try {
          const res = await window.liem.downloader.getInfo(url)
          if (res.success) {
            setVideoInfo(res.info)
          } else {
            console.error('Failed to get video info:', res.error)
          }
        } catch (err) {
          console.error('Failed to fetch info:', err)
        } finally {
          setLoadingInfo(false)
        }
      }, 600)
      return () => clearTimeout(timer)
    } else if (!ytId) {
      setVideoInfo(null)
      setLastFetchedUrl('')
    }
  }, [url])

  // Listen to install progress
  useEffect(() => {
    if (binariesState === 'installing') {
      const unsubscribe = window.liem.downloader.onInstallProgress((progress) => {
        setInstallProgress(progress)
      })
      return unsubscribe
    }
  }, [binariesState])

  // Listen to download progress
  useEffect(() => {
    const unsubscribe = window.liem.downloader.onProgress((progress) => {
      setDownloadProgress((prev) => ({
        ...prev,
        ...progress
      }))
      if (progress.status === 'Downloading...') {
        setDownloadState('downloading')
      } else if (progress.status && (progress.status.includes('Merging') || progress.status.includes('Extracting'))) {
        setDownloadState('processing')
      }
    })
    return unsubscribe
  }, [])

  // Reset quality and format when format type changes
  const handleFormatTypeChange = (type) => {
    setFormatType(type)
    if (type === 'video') {
      setFormat('mp4')
      setQuality('1080p')
    } else {
      setFormat('mp3')
      setQuality('320kbps')
    }
  }

  // Reset quality when format changes
  const handleFormatChange = (newFormat) => {
    setFormat(newFormat)
    if (['mp4', 'mkv', 'webm'].includes(newFormat)) {
      setQuality('1080p')
    } else if (['wav', 'flac'].includes(newFormat)) {
      setQuality('lossless')
    } else {
      setQuality('320kbps')
    }
  }

  // Handle browse folder
  const handleBrowseFolder = async () => {
    try {
      const selected = await window.liem.downloader.selectFolder()
      if (selected) {
        setTargetDir(selected)
        localStorage.setItem('downloader_target_dir', selected)
      }
    } catch (err) {
      console.error('Failed to select folder:', err)
    }
  }

  // Handle engine install (retry manually)
  const handleInstallEngine = () => {
    installEngine()
  }

  // Handle start download
  const handleStartDownload = async () => {
    if (!url.trim() || !getYouTubeId(url)) return
    setDownloadState('starting')
    setDownloadError(null)
    setDownloadProgress({
      title: 'Initializing download...',
      percent: 0,
      speed: '0 KiB/s',
      eta: 'Unknown',
      status: 'Connecting...'
    })

    setLastDownloadedFile(null)

    try {
      const res = await window.liem.downloader.start({
        url: url.trim(),
        format,
        quality,
        targetDir
      })

      if (res.success) {
        setDownloadState('completed')
        setDownloadProgress((prev) => ({
          ...prev,
          percent: 100,
          status: 'Download Completed!'
        }))
        setUrl('') // Clear URL input on success
        if (res.result && res.result.filePath) {
          setLastDownloadedFile(res.result.filePath)
        }
      } else {
        setDownloadState('error')
        setDownloadError(res.error || 'Failed to download video.')
      }
    } catch (err) {
      setDownloadState('error')
      setDownloadError(err.message || 'An error occurred during the download process.')
    }
  }

  // Handle cancel download
  const handleCancelDownload = async () => {
    try {
      await window.liem.downloader.cancel()
      setDownloadState('idle')
    } catch (err) {
      console.error('Failed to cancel download:', err)
    }
  }

  return (
    <div className="p-7 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Youtube Downloader</h1>
        <p className="text-liem-text-dim text-sm mt-1">Download high-quality video or extract audio from YouTube</p>
      </div>

      {/* State 1: Checking status */}
      {binariesState === 'checking' && (
        <div className="bg-liem-sidebar border border-liem-border rounded-[6px] p-6 text-center">
          <div className="text-liem-accent text-lg font-medium animate-pulse mb-1">Checking requirements...</div>
          <p className="text-liem-text-dim text-xs">Verifying download engine and dependencies...</p>
        </div>
      )}

      {/* State 2: Missing binaries */}
      {binariesState === 'missing' && (
        <div className="bg-liem-sidebar border border-liem-border rounded-[6px] p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Downloader Engine Required</h3>
            <p className="text-xs text-liem-text-dim leading-relaxed">
              To download files from YouTube, the application needs to install <code className="text-liem-accent bg-black/40 px-1 py-0.5 rounded">yt-dlp</code> and <code className="text-liem-accent bg-black/40 px-1 py-0.5 rounded">ffmpeg</code> executables. These will be downloaded and placed securely in your AppData directory (~70MB).
            </p>
          </div>

          {installError && (
            <div className="bg-red-950/20 border border-red-900/50 rounded-[4px] px-3 py-2 text-xs text-red-400">
              {installError}
            </div>
          )}

          <button
            onClick={handleInstallEngine}
            className="bg-liem-accent hover:bg-amber-700 text-white font-semibold rounded-[4px] px-5 py-2 text-xs transition-colors"
          >
            Install Downloader Engine
          </button>
        </div>
      )}

      {/* State 3: Installing binaries */}
      {binariesState === 'installing' && (
        <div className="bg-liem-sidebar border border-liem-border rounded-[6px] p-6 space-y-4">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#d4d4d4] font-medium">{installProgress.status || 'Downloading dependencies...'}</span>
            <span className="text-liem-accent font-semibold">{installProgress.percent}%</span>
          </div>

          <div className="w-full h-1.5 bg-[#2e2e2e] rounded-full overflow-hidden">
            <div
              className="h-full bg-liem-accent transition-all duration-300 rounded-full"
              style={{ width: `${installProgress.percent}%` }}
            />
          </div>
          <p className="text-[10px] text-liem-text-dim">Please do not close the application during setup.</p>
        </div>
      )}

      {/* State 4: Ready to download */}
      {binariesState === 'ready' && (
        <div className="space-y-6">
          
          {/* Main Download Form */}
          <div className="bg-liem-sidebar border border-liem-border rounded-[6px] p-5 space-y-4">
            
            {/* Input URL */}
            <div>
              <label className="block text-[11px] font-semibold text-liem-accent uppercase tracking-widest mb-2">
                YouTube URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={downloadState !== 'idle' && downloadState !== 'completed' && downloadState !== 'error'}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-black/40 border border-[#2e2e2e] rounded-[4px] px-3.5 py-2.5 text-xs text-liem-text placeholder-[#444] outline-none focus:border-liem-accent transition-colors"
              />

              {/* Skeleton Loader for Preview */}
              {loadingInfo && (
                <div className="mt-3 flex gap-3 p-3 bg-black/20 border border-[#1e1e1e] rounded-[4px] animate-pulse">
                  <div className="w-[120px] h-[67px] bg-[#1a1a1a] rounded-[4px] shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3.5 bg-[#1a1a1a] rounded w-3/4" />
                    <div className="h-3 bg-[#1a1a1a] rounded w-1/2" />
                  </div>
                </div>
              )}

              {/* Actual Video Preview Card */}
              {videoInfo && !loadingInfo && (
                <div className="mt-3 flex gap-3 p-3 bg-[#161616] border border-[#2a2a2a] rounded-[4px] hover:border-white/10 transition-colors">
                  <div className="relative w-[120px] h-[67px] rounded-[4px] overflow-hidden bg-black shrink-0 border border-white/5">
                    {videoInfo.thumbnail ? (
                      <img src={videoInfo.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center text-[10px] text-liem-text-dim">No Image</div>
                    )}
                    {videoInfo.duration > 0 && (
                      <span className="absolute bottom-1 right-1 bg-black/85 text-[9px] font-semibold text-white px-1 py-0.5 rounded-[2px] font-mono leading-none">
                        {formatDuration(videoInfo.duration)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-xs font-semibold text-white truncate leading-snug mb-1" title={videoInfo.title}>
                      {videoInfo.title}
                    </div>
                    <div className="text-[10px] text-liem-text-dim truncate">
                      {videoInfo.uploader}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Target Save Directory */}
            <div>
              <label className="block text-[11px] font-semibold text-liem-accent uppercase tracking-widest mb-2">
                Save Folder
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetDir}
                  readOnly
                  placeholder="Select output directory..."
                  className="flex-1 bg-black/40 border border-[#2e2e2e] rounded-[4px] px-3 py-2 text-xs text-liem-text outline-none select-text cursor-default"
                />
                <button
                  onClick={handleBrowseFolder}
                  disabled={downloadState !== 'idle' && downloadState !== 'completed' && downloadState !== 'error'}
                  className="bg-[#2a2a2a] hover:bg-[#333] border border-[#3e3e3e] text-xs font-semibold px-4 py-2 rounded-[4px] text-white transition-all shrink-0"
                >
                  Browse
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              
              {/* Type Switcher */}
              <div>
                <label className="block text-[11px] font-semibold text-liem-accent uppercase tracking-widest mb-2">
                  Type
                </label>
                <div className="flex gap-2 bg-black/30 p-1 rounded-[4px] border border-[#222]">
                  <button
                    onClick={() => handleFormatTypeChange('video')}
                    disabled={downloadState !== 'idle' && downloadState !== 'completed' && downloadState !== 'error'}
                    className={`flex-1 py-1.5 text-center text-xs font-medium rounded-[3px] transition-all ${
                      formatType === 'video'
                        ? 'bg-liem-accent text-white font-semibold'
                        : 'text-liem-text-dim hover:text-white'
                    }`}
                  >
                    Video
                  </button>
                  <button
                    onClick={() => handleFormatTypeChange('audio')}
                    disabled={downloadState !== 'idle' && downloadState !== 'completed' && downloadState !== 'error'}
                    className={`flex-1 py-1.5 text-center text-xs font-medium rounded-[3px] transition-all ${
                      formatType === 'audio'
                        ? 'bg-liem-accent text-white font-semibold'
                        : 'text-liem-text-dim hover:text-white'
                    }`}
                  >
                    Audio
                  </button>
                </div>
              </div>

              {/* Format Dropdown */}
              <div>
                <label className="block text-[11px] font-semibold text-liem-accent uppercase tracking-widest mb-2">
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => handleFormatChange(e.target.value)}
                  disabled={downloadState !== 'idle' && downloadState !== 'completed' && downloadState !== 'error'}
                  className="w-full bg-[#161616] border border-[#2e2e2e] rounded-[4px] px-3 py-2 text-xs text-liem-text outline-none focus:border-liem-accent transition-colors cursor-pointer"
                >
                  {formatType === 'video' ? (
                    <>
                      <option value="mp4">MP4 (Default)</option>
                      <option value="mkv">MKV</option>
                      <option value="webm">WebM</option>
                    </>
                  ) : (
                    <>
                      <option value="mp3">MP3 (Default)</option>
                      <option value="m4a">M4A</option>
                      <option value="wav">WAV</option>
                      <option value="flac">FLAC</option>
                    </>
                  )}
                </select>
              </div>

              {/* Quality Dropdown */}
              <div>
                <label className="block text-[11px] font-semibold text-liem-accent uppercase tracking-widest mb-2">
                  Quality
                </label>
                {formatType === 'video' ? (
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    disabled={downloadState !== 'idle' && downloadState !== 'completed' && downloadState !== 'error'}
                    className="w-full bg-[#161616] border border-[#2e2e2e] rounded-[4px] px-3 py-2 text-xs text-liem-text outline-none focus:border-liem-accent transition-colors cursor-pointer"
                  >
                    <option value="best">Best Quality (Default)</option>
                    <option value="1080p">1080p Full HD</option>
                    <option value="720p">720p HD</option>
                    <option value="480p">480p SD</option>
                    <option value="360p">360p Low</option>
                  </select>
                ) : (
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    disabled={(downloadState !== 'idle' && downloadState !== 'completed' && downloadState !== 'error') || ['wav', 'flac'].includes(format)}
                    className="w-full bg-[#161616] border border-[#2e2e2e] rounded-[4px] px-3 py-2 text-xs text-liem-text outline-none focus:border-liem-accent transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {['wav', 'flac'].includes(format) ? (
                      <option value="lossless">Lossless</option>
                    ) : (
                      <>
                        <option value="320kbps">320 kbps (High Quality)</option>
                        <option value="256kbps">256 kbps</option>
                        <option value="192kbps">192 kbps (Medium Quality)</option>
                        <option value="128kbps">128 kbps</option>
                      </>
                    )}
                  </select>
                )}
              </div>

            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              {downloadState === 'idle' || downloadState === 'completed' || downloadState === 'error' ? (
                <button
                  onClick={handleStartDownload}
                  disabled={!url.trim() || !getYouTubeId(url)}
                  className="w-full bg-liem-accent hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-[4px] py-2.5 text-xs transition-colors"
                >
                  Start Download
                </button>
              ) : (
                <button
                  onClick={handleCancelDownload}
                  className="w-full bg-[#1a0a0a] hover:bg-[#2a1818] text-[#e05555] hover:text-[#ff6b6b] font-semibold rounded-[4px] py-2.5 text-xs transition-colors border border-[#3a2020]"
                >
                  Cancel Download
                </button>
              )}
            </div>

          </div>

          {/* Download Progress Status Box */}
          {downloadState !== 'idle' && (
            <div className="bg-liem-sidebar border border-liem-border rounded-[6px] p-5 space-y-4">
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-liem-accent uppercase tracking-wider">
                  {downloadProgress.status || 'Processing...'}
                </div>
                <div className="text-xs font-semibold text-white truncate max-w-full" title={downloadProgress.title}>
                  {downloadProgress.title}
                </div>
              </div>

              {downloadState !== 'completed' && downloadState !== 'error' && (
                <div className="space-y-2">
                  <div className="w-full h-1.5 bg-[#2e2e2e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-liem-accent transition-all duration-300 rounded-full"
                      style={{ width: `${downloadProgress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-liem-text-dim font-mono">
                    <div>Speed: <span className="text-[#c0c0c0] font-semibold">{downloadProgress.speed}</span></div>
                    <div>ETA: <span className="text-[#c0c0c0] font-semibold">{downloadProgress.eta}</span></div>
                    <div>Progress: <span className="text-liem-accent font-semibold">{Math.round(downloadProgress.percent)}%</span></div>
                  </div>
                </div>
              )}

              {downloadState === 'completed' && (
                <div className="flex flex-col gap-2.5 bg-green-950/20 border border-green-900/40 rounded-[4px] p-4">
                  <div className="flex items-center gap-2 text-xs text-green-400">
                    <span>Successfully downloaded!</span>
                  </div>
                  {lastDownloadedFile && (
                    <button
                      onClick={() => window.liem.downloader.showFile(lastDownloadedFile)}
                      className="self-start text-[11px] bg-green-900/40 hover:bg-green-800/50 border border-green-700/30 text-green-300 font-semibold px-3 py-1.5 rounded-[4px] transition-all"
                    >
                      Show in Folder
                    </button>
                  )}
                </div>
              )}

              {downloadState === 'error' && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/20 border border-red-900/50 rounded-[4px] px-3.5 py-2.5">
                    <div className="flex-1 break-all">{downloadError || 'Failed to download.'}</div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}
    </div>
  )
}
