import { useState, useEffect } from 'react'
import DiscordPreview from '../components/DiscordPreview'
import netflixLogo from '../assets/netflix.png'
import youtubeLogo from '../assets/youtube.jpg'
import dimsumLogo from '../assets/dimsum_studio.png'
import wetvLogo from '../assets/wetv.png'
import customLogo from '../assets/icon.png'

const PRESETS = [
  {
    id: 'netflix',
    name: 'Netflix',
    emoji: '🎬',
    logo: netflixLogo,
    clientId: '1495713625111793694',
    fields: [
      { key: 'title', label: 'Title', placeholder: 'Inception' },
      { key: 'episode', label: 'Episode', placeholder: '5 (optional)' },
      { key: 'season', label: 'Season', placeholder: '2 (optional)' }
    ],
    buildActivity(f, showTimestamp) {
      const epState = (() => {
        if (!f.episode) return undefined
        const ep = `Eps ${f.episode}`
        return f.season ? `${ep} · Season ${f.season}` : ep
      })()
      return {
        details: (f.title || 'Idle').padEnd(2, ' '),
        state: epState,
        largeImageKey: 'netflix',
        largeImageText: 'Netflix',
        ...(showTimestamp && { startTimestamp: Date.now() })
      }
    }
  },
  {
    id: 'wetv',
    name: 'WeTV',
    emoji: '📺',
    logo: wetvLogo,
    clientId: '1529000890722291762',
    fields: [
      { key: 'title', label: 'Title', placeholder: 'Love Between Fairy and Devil' },
      { key: 'episode', label: 'Episode', placeholder: '12 (optional)' },
      { key: 'season', label: 'Season', placeholder: '1 (optional)' }
    ],
    buildActivity(f, showTimestamp) {
      const epState = (() => {
        if (!f.episode) return undefined
        const ep = `Eps ${f.episode}`
        return f.season ? `${ep} · Season ${f.season}` : ep
      })()
      return {
        details: (f.title || 'Watching WeTV').padEnd(2, ' '),
        state: epState,
        largeImageKey: 'wetv',
        largeImageText: 'WeTV',
        ...(showTimestamp && { startTimestamp: Date.now() })
      }
    }
  },
  {
    id: 'youtube',
    name: 'YouTube',
    emoji: '▶️',
    logo: youtubeLogo,
    clientId: '1495713746642014309',
    fields: [
      { key: 'title', label: 'Video Title', placeholder: 'My Favorite Video' },
      { key: 'channel', label: 'Channel', placeholder: 'Channel Name (optional)' }
    ],
    buildActivity(f, showTimestamp) {
      return {
        details: f.title || 'Watching a video',
        state: f.channel ? `by ${f.channel}` : undefined,
        largeImageKey: 'youtube',
        largeImageText: 'YouTube',
        ...(showTimestamp && { startTimestamp: Date.now() })
      }
    }
  },
  {
    id: 'dimsum',
    name: 'Dimsum Studio',
    emoji: '🥟',
    logo: dimsumLogo,
    clientId: '1506975051776528584',
    fields: [
      { key: 'status', label: 'Status', placeholder: 'Creating content' }
    ],
    buildActivity(f, showTimestamp) {
      return {
        details: (f.status || 'Creating content').padEnd(2, ' '),
        largeImageKey: 'dimsum_studio',
        largeImageText: 'Dimsum Studio',
        ...(showTimestamp && { startTimestamp: Date.now() })
      }
    }
  },
  {
    id: 'custom',
    name: 'Custom',
    emoji: '⚙️',
    logo: customLogo,
    clientId: '1459475872732938302',
    fields: [
      { key: 'text1', label: 'Text 1 (Details)', placeholder: 'Custom Text 1...' },
      { key: 'text2', label: 'Text 2 (State)', placeholder: 'Custom Text 2... (optional)' }
    ],
    buildActivity(f, showTimestamp) {
      return {
        details: (f.text1 || 'Idle').padEnd(2, ' '),
        state: f.text2 ? f.text2 : undefined,
        ...(showTimestamp && { startTimestamp: Date.now() })
      }
    }
  }
]


function loadLocal() {
  try { return JSON.parse(localStorage.getItem('fakerpc') ?? '{}') } catch { return {} }
}

export default function FakeRPC() {
  const saved = loadLocal()

  const [presetId, setPresetId] = useState(saved.presetId ?? 'netflix')
  const [fields, setFields] = useState(saved.fields ?? {})
  const showTimestamp = true
  const [activePresetId, setActivePresetId] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const preset = PRESETS.find((p) => p.id === presetId)
  const isActive = activePresetId === presetId

  useEffect(() => {
    window.liem.rpc.status().then((s) => {
      if (s.connected) {
        const saved = loadLocal()
        setActivePresetId(saved.activePresetId ?? null)
        setStatus('active')
      }
    })
  }, [])

  useEffect(() => {
    localStorage.setItem('fakerpc', JSON.stringify({ presetId, fields, showTimestamp, activePresetId }))
  }, [presetId, fields, showTimestamp, activePresetId])

  function handlePresetChange(id) {
    setPresetId(id)
    setFields({})
    setError(null)
  }

  function setField(key, value) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  async function handleActivate() {
    setStatus('connecting')
    setError(null)
    const activity = preset.buildActivity(fields, showTimestamp)
    const result = await window.liem.rpc.activate({ clientId: preset.clientId, activity })
    if (result.success) {
      setActivePresetId(presetId)
      setStatus('active')
    } else {
      setStatus('error')
      setError(result.error)
    }
  }

  async function handleDeactivate() {
    await window.liem.rpc.deactivate()
    setActivePresetId(null)
    setStatus('idle')
  }

  return (
    <div className="p-7 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">FakeRPC</h1>
        <p className="text-liem-text-dim text-sm mt-1">Set a custom Discord Rich Presence for any app</p>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-7">
        <div className="space-y-6">
          {/* Presets */}
          <div>
            <label className="block text-[11px] font-semibold text-liem-accent uppercase tracking-widest mb-3">
              Preset
            </label>
            <div className="flex flex-wrap gap-2.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetChange(p.id)}
                  className={`flex items-center gap-2.5 py-1.5 px-4 rounded-[4px] text-xs font-medium transition-all border shrink-0 ${
                    presetId === p.id
                      ? 'bg-[#2a1f0e] border-liem-accent text-liem-accent font-semibold'
                      : 'bg-[#1a1a1a] border-liem-border text-[#abb2bf] hover:bg-liem-hover hover:text-white'
                  }`}
                >
                  <img src={p.logo} alt="" className="w-6 h-6 object-cover rounded-[2px] shrink-0" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic fields */}
          <div>
            <label className="block text-[11px] font-semibold text-liem-accent uppercase tracking-widest mb-3">
              Details
            </label>
            <div className="space-y-3">
              {preset?.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-liem-text-dim mb-1">{field.label}</label>
                  <input
                    type="text"
                    value={fields[field.key] ?? ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-[4px] px-3 py-2 text-xs text-liem-text placeholder-[#3a3a3a] outline-none focus:border-liem-accent transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>



          {error && (
            <div className="bg-red-950/20 border border-red-900/50 rounded-[4px] px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {isActive ? (
            <button
              onClick={handleDeactivate}
              className="w-full bg-[#1a0a0a] hover:bg-[#2a1818] text-[#e05555] hover:text-[#ff6b6b] font-semibold rounded-[4px] py-2.5 text-xs transition-colors border border-[#3a2020]"
            >
              Deactivate
            </button>
          ) : (
            <button
              onClick={handleActivate}
              disabled={status === 'connecting'}
              className="w-full bg-liem-accent hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-[4px] py-2.5 text-xs transition-colors"
            >
              {status === 'connecting' ? 'Connecting to Discord…' : 'Activate RPC'}
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-liem-accent uppercase tracking-widest mb-3">
              Discord Preview
            </label>
            <DiscordPreview
              preset={preset}
              fields={fields}
              showTimestamp={showTimestamp}
              isActive={isActive}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
