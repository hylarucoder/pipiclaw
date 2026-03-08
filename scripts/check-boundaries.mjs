#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

const PROJECT_ROOT = process.cwd()
const AGENT_CORE_ROOT = path.resolve(PROJECT_ROOT, 'packages/agent-core')
const RENDERER_ROOT = path.resolve(PROJECT_ROOT, 'packages/renderer')
const DESKTOP_ROOT = path.resolve(PROJECT_ROOT, 'apps/desktop')
const FILE_EXTENSIONS = new Set(['.ts', '.tsx'])

const rendererImportBanPatterns = [
  /^@pipiclaw\/desktop(?:\/|$)/,
  /^apps\/desktop(?:\/|$)/,
  /(?:^|\/)apps\/desktop(?:\/|$)/,
  /^@renderer\/components\/webui\/legacy(?:\/|$)/,
  /(?:^|\/)components\/webui\/legacy(?:\/|$)/
]

const agentCoreImportBanPatterns = [
  /^react(?:\/|$)/,
  /^react-dom(?:\/|$)/,
  /^electron$/,
  /^@renderer(?:\/|$)/,
  /^@pipiclaw\/renderer(?:\/|$)/,
  /^features\/webui(?:\/|$)/,
  /^apps\/desktop(?:\/|$)/,
  /(?:^|\/)apps\/desktop(?:\/|$)/
]

const agentCoreDomGlobals = new Set(['window', 'document'])

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

function toRelative(filePath) {
  return path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/')
}

function normalizeSpecifier(specifier) {
  return specifier.replace(/\\/g, '/')
}

function isRelativeSpecifier(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../')
}

function resolveImportTarget(fromFilePath, specifier) {
  if (!isRelativeSpecifier(specifier)) return null
  return path.resolve(path.dirname(fromFilePath), specifier)
}

function matchesAnyPattern(specifier, patterns) {
  return patterns.some((pattern) => pattern.test(specifier))
}

function isWithinDir(candidatePath, dirPath) {
  const relativePath = path.relative(dirPath, candidatePath)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function getLineAndColumn(sourceFile, position) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(position)
  return {
    line: line + 1,
    column: character + 1
  }
}

function pushViolation(violations, sourceFile, node, message) {
  const { line, column } = getLineAndColumn(sourceFile, node.getStart(sourceFile))
  violations.push({
    filePath: sourceFile.fileName,
    line,
    column,
    message
  })
}

function visitImports({ sourceFile, filePath, violations, rootKind }) {
  function checkSpecifier(node, rawSpecifier) {
    const specifier = normalizeSpecifier(rawSpecifier)
    const resolvedTarget = resolveImportTarget(filePath, specifier)

    if (rootKind === 'renderer') {
      if (matchesAnyPattern(specifier, rendererImportBanPatterns)) {
        pushViolation(
          violations,
          sourceFile,
          node,
          `packages/renderer 不能依赖 desktop 壳层: "${specifier}"`
        )
        return
      }

      if (resolvedTarget && isWithinDir(resolvedTarget, DESKTOP_ROOT)) {
        pushViolation(
          violations,
          sourceFile,
          node,
          `packages/renderer 不能通过相对路径依赖 desktop 壳层: "${specifier}"`
        )
      }
    }

    if (rootKind === 'agent-core') {
      if (matchesAnyPattern(specifier, agentCoreImportBanPatterns)) {
        pushViolation(
          violations,
          sourceFile,
          node,
          `packages/agent-core 存在非法依赖: "${specifier}"`
        )
        return
      }

      if (
        resolvedTarget &&
        (isWithinDir(resolvedTarget, DESKTOP_ROOT) || isWithinDir(resolvedTarget, RENDERER_ROOT))
      ) {
        pushViolation(
          violations,
          sourceFile,
          node,
          `packages/agent-core 不能通过相对路径依赖 renderer/desktop: "${specifier}"`
        )
      }
    }
  }

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      checkSpecifier(node.moduleSpecifier, node.moduleSpecifier.text)
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      checkSpecifier(node.arguments[0], node.arguments[0].text)
    }

    if (rootKind === 'agent-core' && ts.isIdentifier(node) && agentCoreDomGlobals.has(node.text)) {
      pushViolation(
        violations,
        sourceFile,
        node,
        `packages/agent-core 不能使用 DOM global "${node.text}"`
      )
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

async function collectViolations(rootPath, rootKind) {
  const files = await walk(rootPath)
  const violations = []

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )
    visitImports({ sourceFile, filePath, violations, rootKind })
  }

  return violations
}

async function main() {
  const violations = [
    ...(await collectViolations(RENDERER_ROOT, 'renderer')),
    ...(await collectViolations(AGENT_CORE_ROOT, 'agent-core'))
  ]

  if (violations.length === 0) {
    console.log('Boundary Check')
    console.log('==============')
    console.log('No boundary violations found.')
    return
  }

  console.error('Boundary Check')
  console.error('==============')
  console.error(`Found ${violations.length} violation(s):`)

  for (const violation of violations) {
    console.error(
      `${toRelative(violation.filePath)}:${violation.line}:${violation.column}  ${violation.message}`
    )
  }

  process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
