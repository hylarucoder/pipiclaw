#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const WEBUI_ROOT = path.resolve(process.cwd(), 'packages/renderer/src/features/webui')
const FILE_EXTENSIONS = new Set(['.ts', '.tsx'])
const MINI_LIT_IMPORT_PATTERN = /from\s+['"]@mariozechner\/mini-lit[^'"]*['"]/g
const MINI_LIT_SIDE_EFFECT_PATTERN = /import\s+['"]@mariozechner\/mini-lit[^'"]*['"]/g
const LIT_IMPORT_PATTERN = /from\s+['"]lit(?:\/[^'"]*)?['"]/g
const CUSTOM_ELEMENT_PATTERN = /@customElement\(/g

async function walk(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)))
      continue
    }
    if (!entry.isFile()) continue
    if (!FILE_EXTENSIONS.has(path.extname(entry.name))) continue
    files.push(fullPath)
  }

  return files
}

function matchCount(content, pattern) {
  return content.match(pattern)?.length ?? 0
}

function toProjectRelative(filePath) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/')
}

function toWebuiBucket(filePath) {
  const relative = path.relative(WEBUI_ROOT, filePath).replace(/\\/g, '/')
  const [bucket] = relative.split('/')
  return bucket || '(root)'
}

async function main() {
  const files = await walk(WEBUI_ROOT)
  const rows = []

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8')
    const miniLitCount =
      matchCount(content, MINI_LIT_IMPORT_PATTERN) + matchCount(content, MINI_LIT_SIDE_EFFECT_PATTERN)
    const litCount = matchCount(content, LIT_IMPORT_PATTERN)
    const customElementCount = matchCount(content, CUSTOM_ELEMENT_PATTERN)
    rows.push({
      filePath,
      relativePath: toProjectRelative(filePath),
      bucket: toWebuiBucket(filePath),
      miniLitCount,
      litCount,
      customElementCount
    })
  }

  const miniLitRows = rows.filter((row) => row.miniLitCount > 0)
  const litRows = rows.filter((row) => row.litCount > 0)
  const customElementRows = rows.filter((row) => row.customElementCount > 0)

  const totalMiniLitImports = miniLitRows.reduce((sum, row) => sum + row.miniLitCount, 0)
  const totalLitImports = litRows.reduce((sum, row) => sum + row.litCount, 0)
  const totalCustomElements = customElementRows.reduce((sum, row) => sum + row.customElementCount, 0)

  const bucketStats = new Map()
  for (const row of rows) {
    const current = bucketStats.get(row.bucket) ?? {
      files: 0,
      miniLitFiles: 0,
      miniLitImports: 0,
      litFiles: 0,
      litImports: 0
    }
    current.files += 1
    if (row.miniLitCount > 0) {
      current.miniLitFiles += 1
      current.miniLitImports += row.miniLitCount
    }
    if (row.litCount > 0) {
      current.litFiles += 1
      current.litImports += row.litCount
    }
    bucketStats.set(row.bucket, current)
  }

  const topMiniLitFiles = miniLitRows
    .slice()
    .sort((left, right) => right.miniLitCount - left.miniLitCount || left.relativePath.localeCompare(right.relativePath))
    .slice(0, 20)

  console.log('Lit Migration Report')
  console.log('====================')
  console.log(`Scope: ${toProjectRelative(WEBUI_ROOT)}`)
  console.log(`Total TS/TSX files: ${rows.length}`)
  console.log(`Files using mini-lit: ${miniLitRows.length}`)
  console.log(`mini-lit import statements: ${totalMiniLitImports}`)
  console.log(`Files using lit: ${litRows.length}`)
  console.log(`lit import statements: ${totalLitImports}`)
  console.log(`@customElement declarations: ${totalCustomElements}`)
  console.log('')
  console.log('By Bucket')
  console.log('---------')

  for (const [bucket, stat] of [...bucketStats.entries()].sort((left, right) =>
    left[0].localeCompare(right[0])
  )) {
    console.log(
      `${bucket}: files=${stat.files}, miniLitFiles=${stat.miniLitFiles}, miniLitImports=${stat.miniLitImports}, litFiles=${stat.litFiles}, litImports=${stat.litImports}`
    )
  }

  console.log('')
  console.log('Top mini-lit files')
  console.log('------------------')
  for (const row of topMiniLitFiles) {
    console.log(`${row.miniLitCount.toString().padStart(2, ' ')}  ${row.relativePath}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
