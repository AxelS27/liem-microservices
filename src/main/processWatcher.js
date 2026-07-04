import { exec } from 'child_process'
import { requestActivity, releaseActivity } from './rpcPriority.js'

const ZOOM_CLIENT_ID = '1495738866139795546'
const WATCH_CMD = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-Process -Name Zoom -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match \'^(Zoom Meeting|Zoom Webinar|Zoom Rapat|Zoom Pertemuan|Rapat Zoom|Pertemuan Zoom)$\' }) { Write-Output \'running\' }"'

let interval = null
let running = false
let startTimestamp = null

function poll() {
  exec(WATCH_CMD, async (err, stdout) => {
    if (err) return
    const nowRunning = stdout.toLowerCase().includes('running')
    if (nowRunning === running) return
    running = nowRunning

    if (nowRunning) {
      startTimestamp = Date.now()
      await requestActivity('zoom', ZOOM_CLIENT_ID, {
        details: 'In a meeting',
        startTimestamp
      })
    } else {
      startTimestamp = null
      await releaseActivity('zoom')
    }
  })
}

export function startWatcher() {
  poll()
  interval = setInterval(poll, 5000)
}

export function stopWatcher() {
  if (interval) { clearInterval(interval); interval = null }
}
