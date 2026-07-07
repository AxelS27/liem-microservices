import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  return (
    <aside className="w-[260px] bg-liem-sidebar border border-white/10 rounded-[10px] flex flex-col shrink-0 overflow-hidden">
      <div className="px-4 pt-3.5 pb-2 flex items-center select-none">
        <span className="text-[13px] font-semibold tracking-[0.1px] text-[#c0c0c0]">Control Panel</span>
      </div>

      <nav className="flex-1 px-2 pt-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 h-[34px] rounded-[5px] text-[13px] mb-1 transition-all ${
              isActive
                ? 'bg-white/[0.07] text-white font-medium'
                : 'text-[#abb2bf] hover:text-white hover:bg-white/[0.05]'
            }`
          }
        >
          <span className="text-base leading-none">⊞</span>
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/fakerpc"
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 h-[34px] rounded-[5px] text-[13px] mb-1 transition-all ${
              isActive
                ? 'bg-white/[0.07] text-white font-medium'
                : 'text-[#abb2bf] hover:text-white hover:bg-white/[0.05]'
            }`
          }
        >
          <span className="text-base leading-none">🎭</span>
          <span>FakeRPC</span>
        </NavLink>

        <NavLink
          to="/downloader"
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 h-[34px] rounded-[5px] text-[13px] mb-1 transition-all ${
              isActive
                ? 'bg-white/[0.07] text-white font-medium'
                : 'text-[#abb2bf] hover:text-white hover:bg-white/[0.05]'
            }`
          }
        >
          <span className="text-base leading-none">📥</span>
          <span>Downloader</span>
        </NavLink>

        <NavLink
          to="/converter"
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 h-[34px] rounded-[5px] text-[13px] mb-1 transition-all ${
              isActive
                ? 'bg-white/[0.07] text-white font-medium'
                : 'text-[#abb2bf] hover:text-white hover:bg-white/[0.05]'
            }`
          }
        >
          <span className="text-base leading-none">🔄</span>
          <span>Converter</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 h-[34px] rounded-[5px] text-[13px] mb-1 transition-all ${
              isActive
                ? 'bg-white/[0.07] text-white font-medium'
                : 'text-[#abb2bf] hover:text-white hover:bg-white/[0.05]'
            }`
          }
        >
          <span className="text-base leading-none">⚙️</span>
          <span>Settings</span>
        </NavLink>
      </nav>
    </aside>
  )
}
