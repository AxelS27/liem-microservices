import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import Dashboard from './pages/Dashboard'
import FakeRPC from './pages/FakeRPC'
import Downloader from './pages/Downloader'
import Converter from './pages/Converter'
import Settings from './pages/Settings'

export default function App() {
  useEffect(() => {
    window.liem.config.get().then((config) => {
      if (config && config.accentColor) {
        document.documentElement.style.setProperty('--accent', config.accentColor)
      }
    })
  }, [])

  return (
    <HashRouter>
      <div className="flex flex-col h-screen overflow-hidden bg-liem-bg">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden p-2 pt-0 gap-2">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-liem-bg">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/fakerpc" element={<FakeRPC />} />
              <Route path="/downloader" element={<Downloader />} />
              <Route path="/converter" element={<Converter />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  )
}
