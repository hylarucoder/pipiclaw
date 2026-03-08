#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const PROJECT_ROOT = process.cwd()
const LEGACY_WEBUI_SEGMENTS = ['packages', 'renderer', 'features', 'webui']
const LEGACY_WEBUI_PATH = LEGACY_WEBUI_SEGMENTS.join('/')
const LEGACY_WEBUI_ROOT = path.resolve(PROJECT_ROOT, ...LEGACY_WEBUI_SEGMENTS)
const TEXT_FILE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml'
])
const IGNORE_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'build',
  'release',
  'playwright-report',
  'test-results',
  'blob-report'
])
const SCAN_TARGETS = [
  'apps',
  'packages',
  'scripts',
  'AGENTS.md',
  'README.md',
  'ARCHITECTURE.md',
  'docs/runbooks'
]

function toRelative(filePath) {
  return path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/')
}

function getLineAndColumn(content, index) {
  const before = content.slice(0, index)
  const lines = before.split('\n')
  return {
    line: lines.length,
    column: lines.at(-1).length + 1
  }
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

async function walk(targetPath, filePaths) {
  const info = await stat(targetPath)
  if (info.isFile()) {
    if (TEXT_FILE_EXTENSIONS.has(path.extname(targetPath))) {
      filePaths.push(targetPath)
    }
    return
  }

  if (!info.isDirectory()) return

  const entries = await readdir(targetPath, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORE_DIR_NAMES.has(entry.name)) continue
    const fullPath = path.join(targetPath, entry.name)
    if (entry.isDirectory()) {
      await walk(fullPath, filePaths)
      continue
    }

    if (!entry.isFile()) continue
    if (!TEXT_FILE_EXTENSIONS.has(path.extname(entry.name))) continue
    filePaths.push(fullPath)
  }
}

async function collectFilePathViolations() {
  const filePaths = []

  for (const target of SCAN_TARGETS) {
    const fullTargetPath = path.resolve(PROJECT_ROOT, target)
    if (!(await pathExists(fullTargetPath))) continue
    await walk(fullTargetPath, filePaths)
  }

  const violations = []
  for (const filePath of filePaths) {
    const relativePath = toRelative(filePath)
    const content = await readFile(filePath, 'utf8')
    let searchFrom = 0

    while (true) {
      const matchIndex = content.indexOf(LEGACY_WEBUI_PATH, searchFrom)
      if (matchIndex === -1) break

      const { line, column } = getLineAndColumn(content, matchIndex)
      violations.push({
        filePath: relativePath,
        line,
        column,
        message: `检测到已删除的旧路径 "${LEGACY_WEBUI_PATH}"，请改用 "packages/renderer/src/features/webui" 或 "@renderer/features/webui"。`
      })
      searchFrom = matchIndex + LEGACY_WEBUI_PATH.length
    }
  }

  return violations
}

async function main() {
  const violations = []

  if (await pathExists(LEGACY_WEBUI_ROOT)) {
    violations.push({
      filePath: LEGACY_WEBUI_PATH,
      line: 1,
      column: 1,
      message: `旧 webui 副本目录重新出现：${LEGACY_WEBUI_PATH}`
    })
  }

  violations.push(...(await collectFilePathViolations()))

  if (violations.length === 0) {
    console.log('WebUI Source Guard')
    console.log('==================')
    console.log('No legacy webui path regressions found.')
    return
  }

  console.error('WebUI Source Guard')
  console.error('==================')
  console.error(`Found ${violations.length} violation(s):`)

  for (const violation of violations) {
    console.error(
      `${violation.filePath}:${violation.line}:${violation.column}  ${violation.message}`
    )
  }

  process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
