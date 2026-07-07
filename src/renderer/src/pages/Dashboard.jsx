import { useNavigate } from 'react-router-dom'

const services = [
  {
    to: '/fakerpc',
    icon: '🎭',
    name: 'FakeRPC',
    description: 'Set a custom Discord Rich Presence for any app'
  },
  {
    to: '/downloader',
    icon: '📥',
    name: 'Youtube Downloader',
    description: 'Download high-quality video or extract audio from YouTube'
  },
  {
    to: '/converter',
    icon: '🔄',
    name: 'Media Converter',
    description: 'Convert video and audio files to other formats using FFmpeg'
  },
  {
    to: '/settings',
    icon: '⚙️',
    name: 'Settings',
    description: 'Configure Control Panel startup and preferences'
  }
]

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-liem-text-dim text-sm mt-1">Liem microservices running on your machine</p>
      </div>

      <div className="flex gap-4">
        {services.map((s) => (
          <button
            key={s.to}
            onClick={() => navigate(s.to)}
            className="w-52 h-52 flex flex-col items-center justify-center text-center bg-liem-sidebar hover:bg-liem-hover border border-white/10 hover:border-liem-accent/40 rounded-[4px] p-6 transition-all group duration-150"
          >
            <div className="text-4xl mb-4 select-none">{s.icon}</div>
            <div className="font-semibold text-white text-sm mb-1.5 group-hover:text-white">
              {s.name}
            </div>
            <div className="text-[11px] text-liem-text-dim leading-relaxed max-w-[160px]">{s.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
