#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = process.cwd()
const CURRENT_FILE_PATH = fileURLToPath(import.meta.url)
const LEGACY_DIR_SEGMENTS = ['packages', 'renderer', 'src', 'components', 'webui', 'legacy']
const LEGACY_DIR_ROOT = path.resolve(PROJECT_ROOT, ...LEGACY_DIR_SEGMENTS)
const LEGACY_PATTERNS = [
  'packages/renderer/src/components/webui/legacy',
  '@renderer/components/webui/legacy',
  'legacy/features/webui'
]
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
  'docs/design-docs/core-beliefs.md',
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

async function collectTextViolations() {
  const filePaths = []

  for (const target of SCAN_TARGETS) {
    const fullTargetPath = path.resolve(PROJECT_ROOT, target)
    if (!(await pathExists(fullTargetPath))) continue
    await walk(fullTargetPath, filePaths)
  }

  const violations = []
  for (const filePath of filePaths) {
    if (filePath === CURRENT_FILE_PATH) continue

    const relativePath = toRelative(filePath)
    const content = await readFile(filePath, 'utf8')

    for (const pattern of LEGACY_PATTERNS) {
      let searchFrom = 0
      while (true) {
        const matchIndex = content.indexOf(pattern, searchFrom)
        if (matchIndex === -1) break

        const { line, column } = getLineAndColumn(content, matchIndex)
        violations.push({
          filePath: relativePath,
          line,
          column,
          message: `检测到已删除的 legacy webui 路径 "${pattern}"，请直接依赖当前真源。`
        })
        searchFrom = matchIndex + pattern.length
      }
    }
  }

  return violations
}

async function main() {
  const violations = []

  if (await pathExists(LEGACY_DIR_ROOT)) {
    violations.push({
      filePath: LEGACY_DIR_SEGMENTS.join('/'),
      line: 1,
      column: 1,
      message: 'legacy webui 目录重新出现，必须删除。'
    })
  }

  violations.push(...(await collectTextViolations()))

  if (violations.length === 0) {
    console.log('No Legacy WebUI Guard')
    console.log('=====================')
    console.log('No legacy webui regressions found.')
    return
  }

  console.error('No Legacy WebUI Guard')
  console.error('=====================')
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
