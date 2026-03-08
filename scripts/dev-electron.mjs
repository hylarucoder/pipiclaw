import { spawn } from 'node:child_process'
import { existsSync, watch } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { resolve } from 'node:path'

const rendererUrl = 'http://127.0.0.1:5173'
const rootDir = process.cwd()
const mainEntry = resolve(rootDir, 'dist/desktop/main/index.cjs')
const preloadEntry = resolve(rootDir, 'dist/desktop/preload/index.cjs')
const desktopDistDir = resolve(rootDir, 'dist/desktop')

const children = new Set()
let electronProcess = null
let restartTimer = null
let launchedElectron = false
let shuttingDown = false

function spawnManaged(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
    ...options
  })

  children.add(child)
  child.on('exit', (code, signal) => {
    children.delete(child)
    if (shuttingDown) return
    if (code === 0 || signal === 'SIGTERM') return
    shutdown(code ?? 1)
  })

  return child
}

async function waitForDesktopBuild() {
  while (!existsSync(mainEntry) || !existsSync(preloadEntry)) {
    await delay(150)
  }
}

async function waitForRenderer() {
  for (;;) {
    try {
      const response = await fetch(rendererUrl)
      if (response.ok) return
    } catch {
      // renderer dev server is still starting up
    }
    await delay(250)
  }
}

function launchElectron() {
  if (shuttingDown) return

  electronProcess = spawnManaged(
    'pnpm',
    ['exec', 'electron', '.', '--no-sandbox'],
    {
      env: {
        ...process.env,
        PIPICLAW_RENDERER_URL: rendererUrl
      }
    }
  )
}

function restartElectron() {
  if (restartTimer) clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    restartTimer = null
    if (!launchedElectron) return
    if (electronProcess) {
      const previous = electronProcess
      electronProcess = null
      previous.once('exit', () => launchElectron())
      previous.kill('SIGTERM')
      return
    }
    launchElectron()
  }, 150)
}

function watchDesktopOutput() {
  watch(desktopDistDir, { recursive: true }, (_eventType, filename) => {
    if (!filename) return
    if (!filename.endsWith('.js')) return
    restartElectron()
  })
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true

  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }

  for (const child of [...children]) {
    child.kill('SIGTERM')
  }

  setTimeout(() => {
    process.exit(exitCode)
  }, 50)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

spawnManaged('pnpm', ['--filter', '@pipiclaw/desktop', 'run', 'dev'])
spawnManaged('pnpm', ['--filter', '@pipiclaw/renderer', 'run', 'dev'])

await Promise.all([waitForDesktopBuild(), waitForRenderer()])
watchDesktopOutput()
launchedElectron = true
launchElectron()
