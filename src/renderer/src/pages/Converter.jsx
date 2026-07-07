import { useState, useEffect } from 'react'

// Helper to format bytes to readable string
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function Converter() {
  // Binary installation states: 'checking' | 'missing' | 'installing' | 'ready'
  const [binariesState, setBinariesState] = useState('checking')
  const [installProgress, setInstallProgress] = useState({ status: '', percent: 0 })
  const [installError, setInstallError] = useState(null)

  // File states
  const [selectedFile, setSelectedFile] = useState(null) // { path, name, size }
  const [formatType, setFormatType] = useState('video') // 'video' | 'audio'
  const [outputFormat, setOutputFormat] = useState('mp4')
  const [isDragging, setIsDragging] = useState(false)

  // Conversion states: 'idle' | 'converting' | 'completed' | 'error'
  const [conversionState, setConversionState] = useState('idle')
  const [conversionProgress, setConversionProgress] = useState({ percent: 0, status: '' })
  const [conversionError, setConversionError] = useState(null)
  const [lastConvertedFile, setLastConvertedFile] = useState(null)

  // Check FFmpeg status on mount
  useEffect(() => {
    checkEngineStatus()
  }, [])

  const checkEngineStatus = async () => {
    try {
      const res = await window.liem.converter.check()
      if (res.ready) {
        setBinariesState('ready')
      } else {
        setBinariesState('missing')
      }
    } catch (err) {
      console.error(err)
      setBinariesState('missing')
    }
  }

  // Handle engine install
  const installEngine = async () => {
    setBinariesState('installing')
    setInstallError(null)
    try {
      // Re-use Downloader installer
      const res = await window.liem.downloader.install()
      if (res.success && res.status.ready) {
        setBinariesState('ready')
      } else {
        setBinariesState('missing')
        setInstallError(res.error || 'Failed to install FFmpeg engine.')
      }
    } catch (err) {
      setBinariesState('missing')
      setInstallError(err.message || 'An error occurred during installation.')
    }
  }

  // Listen to install progress
  useEffect(() => {
    if (binariesState === 'installing') {
      const unsubscribe = window.liem.downloader.onInstallProgress((progress) => {
        setInstallProgress(progress)
      })
      return unsubscribe
    }
  }, [binariesState])

  // Listen to conversion progress
  useEffect(() => {
    const unsubscribe = window.liem.converter.onProgress((progress) => {
      setConversionProgress((prev) => ({
        ...prev,
        ...progress
      }))
      if (progress.percent > 0) {
        setConversionState('converting')
      }
    })
    return unsubscribe
  }, [])

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const updateFormatOnSelection = (file) => {
    setSelectedFile({
      path: file.path,
      name: file.name,
      size: file.size
    })
    setConversionState('idle')
    setConversionError(null)
    setLastConvertedFile(null)

    const ext = file.name.split('.').pop().toLowerCase()
    const isAudioExt = ['mp3', 'm4a', 'wav', 'flac', 'ogg'].includes(ext)
    const newType = isAudioExt ? 'audio' : 'video'
    
    setFormatType(newType)
    if (newType === 'video') {
      setOutputFormat(ext === 'mp4' ? 'mov' : 'mp4')
    } else {
      setOutputFormat(ext === 'mp3' ? 'm4a' : 'mp3')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      updateFormatOnSelection(e.dataTransfer.files[0])
    }
  }

  const handleSelectFile = async () => {
    try {
      const file = await window.liem.converter.selectFile()
      if (file) {
        updateFormatOnSelection(file)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleFormatTypeChange = (type) => {
    setFormatType(type)
    const currentExt = selectedFile ? selectedFile.name.split('.').pop().toLowerCase() : ''
    if (type === 'video') {
      setOutputFormat(currentExt === 'mp4' ? 'mov' : 'mp4')
    } else {
      setOutputFormat(currentExt === 'mp3' ? 'm4a' : 'mp3')
    }
  }

  const handleStartConversion = async () => {
    if (!selectedFile) return

    const inputExt = selectedFile.name.split('.').pop().toLowerCase()
    if (outputFormat === inputExt) {
      setConversionState('error')
      setConversionError('Cannot convert to the same format.')
      return
    }

    setConversionState('converting')
    setConversionError(null)
    setConversionProgress({ percent: 0, status: 'Initializing...' })
    setLastConvertedFile(null)

    try {
      const res = await window.liem.converter.start({
        inputPath: selectedFile.path,
        format: outputFormat
      })

      if (res.success && res.result && res.result.outputPath) {
        setConversionState('completed')
        setConversionProgress((prev) => ({
          ...prev,
          percent: 100,
          status: 'Conversion Completed!'
        }))
        setLastConvertedFile(res.result.outputPath)
      } else {
        setConversionState('error')
        setConversionError(res.error || 'Failed to convert file.')
      }
    } catch (err) {
      setConversionState('error')
      setConversionError(err.message || 'An error occurred during conversion.')
    }
  }

  const handleCancelConversion = async () => {
    try {
      await window.liem.converter.cancel()
      setConversionState('idle')
    } catch (err) {
      console.error(err)
    }
  }

  const inputExt = selectedFile ? selectedFile.name.split('.').pop().toLowerCase() : ''
  const isSameFormat = selectedFile && outputFormat === inputExt

  return (
    <div className="p-7 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Media Converter</h1>
        <p className="text-liem-text-dim text-sm mt-1">Convert video and audio files to other formats using FFmpeg</p>
      </div>

      {/* State 1: Checking status */}
      {binariesState === 'checking' && (
        <div className="bg-liem-sidebar border border-liem-border rounded-[6px] p-6 text-center">
          <div className="text-liem-accent text-lg font-medium animate-pulse mb-1">Checking requirements...</div>
          <p className="text-liem-text-dim text-xs">Verifying FFmpeg engine...</p>
        </div>
      )}

      {/* State 2: Missing binaries */}
      {binariesState === 'missing' && (
        <div className="bg-liem-sidebar border border-liem-border rounded-[6px] p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">FFmpeg Engine Required</h3>
            <p className="text-xs text-liem-text-dim leading-relaxed">
              To convert files, the application needs to install the FFmpeg engine binaries (~70MB). If you already set up the Downloader engine, this is the same dependency.
            </p>
          </div>

          {installError && (
            <div className="bg-red-950/20 border border-red-900/50 rounded-[4px] px-3 py-2 text-xs text-red-400">
              {installError}
            </div>
          )}

          <button
            onClick={installEngine}
            className="bg-liem-accent hover:bg-amber-700 text-white font-semibold rounded-[4px] px-5 py-2 text-xs transition-colors"
          >
            Install FFmpeg Engine
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

      {/* State 4: Ready to convert */}
      {binariesState === 'ready' && (
        <div className="space-y-6">

          {/* Input Selector */}
          <div className="bg-liem-sidebar border border-liem-border rounded-[6px] p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-liem-accent uppercase tracking-widest mb-2">
                Source File
              </label>
              
              {!selectedFile ? (
                <div 
                  onClick={handleSelectFile}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-[6px] p-8 text-center cursor-pointer transition-colors bg-black/10 hover:bg-black/20 ${
                    isDragging ? 'border-liem-accent bg-liem-accent/5' : 'border-[#333] hover:border-liem-accent/40'
                  }`}
                >
                  <div className="text-xs font-semibold text-[#d4d4d4] mb-1">
                    {isDragging ? 'Drop file here' : 'Select media file to convert'}
                  </div>
                  <div className="text-[10px] text-liem-text-dim">Supports MP4, MKV, WebM, MOV, AVI, MP3, WAV, FLAC, M4A</div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-black/45 border border-[#2e2e2e] rounded-[4px]">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate" title={selectedFile.name}>
                      {selectedFile.name}
                    </div>
                    <div className="text-[10px] text-liem-text-dim mt-0.5">
                      {formatBytes(selectedFile.size)} &bull; {selectedFile.path}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    disabled={conversionState === 'converting'}
                    className="text-[10px] text-red-400 hover:text-red-300 font-semibold px-2 py-1 rounded hover:bg-red-950/20 transition-all shrink-0 ml-4"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {selectedFile && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {/* Format Type Selector */}
                  <div>
                    <label className="block text-[11px] font-semibold text-liem-accent uppercase tracking-widest mb-2">
                      Output Type
                    </label>
                    <div className="flex gap-2 bg-black/30 p-1 rounded-[4px] border border-[#222]">
                      <button
                        onClick={() => handleFormatTypeChange('video')}
                        disabled={conversionState === 'converting'}
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
                        disabled={conversionState === 'converting'}
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

                  {/* Output Format Dropdown */}
                  <div>
                    <label className="block text-[11px] font-semibold text-liem-accent uppercase tracking-widest mb-2">
                      Target Format
                    </label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      disabled={conversionState === 'converting'}
                      className="w-full bg-[#161616] border border-[#2e2e2e] rounded-[4px] px-3 py-2 text-xs text-liem-text outline-none focus:border-liem-accent transition-colors cursor-pointer"
                    >
                      {formatType === 'video' ? (
                        <>
                          {inputExt !== 'mp4' && <option value="mp4">MP4</option>}
                          {inputExt !== 'mov' && <option value="mov">MOV</option>}
                          {inputExt !== 'mkv' && <option value="mkv">MKV</option>}
                          {inputExt !== 'webm' && <option value="webm">WebM</option>}
                          {inputExt !== 'avi' && <option value="avi">AVI</option>}
                        </>
                      ) : (
                        <>
                          {inputExt !== 'mp3' && <option value="mp3">MP3</option>}
                          {inputExt !== 'm4a' && <option value="m4a">M4A</option>}
                          {inputExt !== 'wav' && <option value="wav">WAV</option>}
                          {inputExt !== 'flac' && <option value="flac">FLAC</option>}
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Convert Action Buttons */}
                <div className="pt-2">
                  {conversionState !== 'converting' ? (
                    <button
                      onClick={handleStartConversion}
                      className="w-full bg-liem-accent hover:bg-amber-700 text-white font-semibold rounded-[4px] py-2.5 text-xs transition-colors"
                    >
                      Start Conversion
                    </button>
                  ) : (
                    <button
                      onClick={handleCancelConversion}
                      className="w-full bg-[#1a0a0a] hover:bg-[#2a1818] text-[#e05555] hover:text-[#ff6b6b] font-semibold rounded-[4px] py-2.5 text-xs transition-colors border border-[#3a2020]"
                    >
                      Cancel Conversion
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Conversion Progress Status Box */}
          {conversionState !== 'idle' && selectedFile && (
            <div className="bg-liem-sidebar border border-liem-border rounded-[6px] p-5 space-y-4">
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-liem-accent uppercase tracking-wider">
                  {conversionProgress.status || 'Processing...'}
                </div>
                <div className="text-xs font-semibold text-white truncate max-w-full" title={selectedFile.name}>
                  {selectedFile.name} &rarr; {outputFormat.toUpperCase()}
                </div>
              </div>

              {conversionState !== 'completed' && conversionState !== 'error' && (
                <div className="space-y-2">
                  <div className="w-full h-1.5 bg-[#2e2e2e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-liem-accent transition-all duration-300 rounded-full"
                      style={{ width: `${conversionProgress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-liem-text-dim font-mono">
                    <div>Status: <span className="text-[#c0c0c0] font-semibold">{conversionProgress.status}</span></div>
                    <div>Progress: <span className="text-liem-accent font-semibold">{Math.round(conversionProgress.percent)}%</span></div>
                  </div>
                </div>
              )}

              {conversionState === 'completed' && (
                <div className="flex flex-col gap-2.5 bg-green-950/20 border border-green-900/40 rounded-[4px] p-4">
                  <div className="flex items-center gap-2 text-xs text-green-400">
                    <span>Successfully converted!</span>
                  </div>
                  {lastConvertedFile && (
                    <button
                      onClick={() => window.liem.converter.showFile(lastConvertedFile)}
                      className="self-start text-[11px] bg-green-900/40 hover:bg-green-800/50 border border-green-700/30 text-green-300 font-semibold px-3 py-1.5 rounded-[4px] transition-all"
                    >
                      Show in Folder
                    </button>
                  )}
                </div>
              )}

              {conversionState === 'error' && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/20 border border-red-900/50 rounded-[4px] px-3.5 py-2.5">
                    <div className="flex-1 break-all">{conversionError || 'Failed to convert file.'}</div>
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
