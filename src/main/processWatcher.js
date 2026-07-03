import { exec } from 'child_process'
import { requestActivity, releaseActivity } from './rpcPriority.js'

const ZOOM_CLIENT_ID = '1495738866139795546'
const WATCH_CMD = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$path = \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged\'; if (Test-Path $path) { $zoomApp = Get-ChildItem -Path $path | Where-Object { $_.PSChildName -match \'zoom\\.exe\' }; if ($zoomApp) { $stopTime = (Get-ItemProperty -Path $zoomApp.PSPath -Name \'LastUsedTimeStop\' -ErrorAction SilentlyContinue).LastUsedTimeStop; if ($stopTime -eq 0) { Write-Output \'running\' } } }"'

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
