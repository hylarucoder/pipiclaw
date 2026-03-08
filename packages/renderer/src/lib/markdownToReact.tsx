import { Fragment, type ReactNode } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize'
import rehypeReact from 'rehype-react'
import rehypeShiki, { type RehypeShikiOptions } from '@shikijs/rehype'
import type { Root, Element, RootContent } from 'hast'
import type { BundledLanguage, LanguageInput } from 'shiki'

export type ThemeMode = 'light' | 'dark' | 'system'

type ThemeName = 'vitesse-light' | 'vitesse-dark'

const THEME_BY_MODE: Record<ThemeMode, ThemeName> = {
  light: 'vitesse-light',
  dark: 'vitesse-dark',
  system: 'vitesse-light'
}

const SUPPORTED_LANGS = [
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'json',
  'bash',
  'shell',
  'markdown',
  'md',
  'yaml',
  'python',
  'go',
  'rust',
  'html',
  'css',
  'scss',
  'java',
  'c',
  'cpp'
] as const

const REHYPE_LANGS = SUPPORTED_LANGS as unknown as (BundledLanguage | LanguageInput)[]

function rehypeProtectMermaid() {
  const walkNode = (node: RootContent | Root): void => {
    if (node.type !== 'element') {
      if ('children' in node && Array.isArray(node.children)) {
        node.children.forEach(walkNode)
      }
      return
    }

    const el = node as Element
    if (el.tagName === 'pre') {
      const codeChild = el.children.find(
        (child): child is Element => child.type === 'element' && child.tagName === 'code'
      )
      if (codeChild) {
        const classNames = codeChild.properties?.className
        if (Array.isArray(classNames)) {
          const isMermaid = classNames.some(
            (className) => typeof className === 'string' && className.includes('language-mermaid')
          )
          if (isMermaid) {
            el.properties = el.properties || {}
            el.properties['data-language'] = 'mermaid'
          }
        }
      }
    }

    if (el.children) {
      el.children.forEach(walkNode)
    }
  }

  return (tree: Root) => {
    walkNode(tree)
  }
}

const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu

function rehypeWrapEmoji() {
  const processTextNode = (text: string): (Element | { type: 'text'; value: string })[] => {
    const parts: (Element | { type: 'text'; value: string })[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = EMOJI_REGEX.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
      }

      parts.push({
        type: 'element',
        tagName: 'span',
        properties: { className: ['emoji'] },
        children: [{ type: 'text', value: match[0] }]
      })

      lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', value: text.slice(lastIndex) })
    }

    return parts.length > 0 ? parts : [{ type: 'text', value: text }]
  }

  const walkNode = (node: RootContent | Root): void => {
    if (node.type === 'element') {
      const el = node as Element
      if (el.tagName === 'code' || el.tagName === 'pre') {
        return
      }

      if (el.children) {
        const newChildren: Element['children'] = []

        for (const child of el.children) {
          if (child.type === 'text' && EMOJI_REGEX.test(child.value)) {
            EMOJI_REGEX.lastIndex = 0
            newChildren.push(...processTextNode(child.value))
          } else {
            walkNode(child)
            newChildren.push(child)
          }
        }

        el.children = newChildren
      }
    } else if ('children' in node && Array.isArray(node.children)) {
      node.children.forEach(walkNode)
    }
  }

  return (tree: Root) => {
    walkNode(tree)
  }
}

type AttrMap = Record<string, string[] | true>
const defaultSchemaShape = defaultSchema as unknown as { tagNames?: string[]; attributes?: AttrMap }
const getDefaultAttrs = (tag: string): string[] =>
  ((defaultSchemaShape.attributes as AttrMap)?.[tag] ?? []) as string[]

const SVG_CORE_ATTRS = ['className', 'style']
const SVG_PAINT_ATTRS = ['fill', 'stroke', 'stroke-width', 'opacity']
const SVG_SHAPE_ATTRS = [...SVG_CORE_ATTRS, ...SVG_PAINT_ATTRS]
const SVG_MARKER_REFS = ['marker-start', 'marker-mid', 'marker-end']
const TABLE_TAGS = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup'] as const
const SVG_TAGS = [
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'defs',
  'marker',
  'clipPath',
  'pattern',
  'style',
  'title',
  'desc'
] as const

const SANITIZE_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchemaShape.tagNames ?? []),
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'caption',
    'colgroup',
    'col',
    ...SVG_TAGS
  ],
  attributes: {
    ...defaultSchemaShape.attributes,
    a: [...getDefaultAttrs('a'), 'href', 'rel', 'target'],
    img: [...getDefaultAttrs('img'), 'src', 'alt'],
    code: [...getDefaultAttrs('code'), 'className'],
    pre: [...getDefaultAttrs('pre'), 'className'],
    span: [...getDefaultAttrs('span'), 'className', 'style'],
    h1: [...getDefaultAttrs('h1'), 'id'],
    h2: [...getDefaultAttrs('h2'), 'id'],
    h3: [...getDefaultAttrs('h3'), 'id'],
    h4: [...getDefaultAttrs('h4'), 'id'],
    ...Object.fromEntries(TABLE_TAGS.map((tag) => [tag, getDefaultAttrs(tag)])),
    th: [...getDefaultAttrs('th'), 'colspan', 'rowspan', 'align'],
    td: [...getDefaultAttrs('td'), 'colspan', 'rowspan', 'align'],
    col: [...getDefaultAttrs('col'), 'span'],
    svg: [
      ...getDefaultAttrs('svg'),
      'xmlns',
      'viewBox',
      'width',
      'height',
      'preserveAspectRatio',
      ...SVG_CORE_ATTRS,
      'aria-label',
      'role'
    ],
    g: [...getDefaultAttrs('g'), 'id', 'transform', ...SVG_CORE_ATTRS],
    path: [...getDefaultAttrs('path'), 'd', 'transform', ...SVG_SHAPE_ATTRS, ...SVG_MARKER_REFS],
    rect: [...getDefaultAttrs('rect'), 'x', 'y', 'width', 'height', 'rx', 'ry', ...SVG_SHAPE_ATTRS],
    circle: [...getDefaultAttrs('circle'), 'cx', 'cy', 'r', ...SVG_SHAPE_ATTRS],
    ellipse: [...getDefaultAttrs('ellipse'), 'cx', 'cy', 'rx', 'ry', ...SVG_SHAPE_ATTRS],
    line: [
      ...getDefaultAttrs('line'),
      'x1',
      'y1',
      'x2',
      'y2',
      ...SVG_SHAPE_ATTRS,
      'marker-start',
      'marker-end'
    ],
    polyline: [...getDefaultAttrs('polyline'), 'points', ...SVG_SHAPE_ATTRS],
    polygon: [...getDefaultAttrs('polygon'), 'points', ...SVG_SHAPE_ATTRS],
    text: [
      ...getDefaultAttrs('text'),
      'x',
      'y',
      'dx',
      'dy',
      'text-anchor',
      'dominant-baseline',
      'font-family',
      'font-size',
      'font-weight',
      'transform',
      ...SVG_SHAPE_ATTRS
    ],
    marker: [
      ...getDefaultAttrs('marker'),
      'id',
      'viewBox',
      'refX',
      'refY',
      'markerWidth',
      'markerHeight',
      'orient',
      'markerUnits',
      ...SVG_CORE_ATTRS
    ],
    defs: getDefaultAttrs('defs'),
    clipPath: [...getDefaultAttrs('clipPath'), 'id'],
    pattern: [...getDefaultAttrs('pattern'), 'id', 'patternUnits', 'width', 'height', 'x', 'y'],
    style: [...getDefaultAttrs('style'), 'type']
  }
}

type ReactProcessor = (markdown: string) => Promise<ReactNode>
const PROCESSORS: Partial<Record<ThemeMode, ReactProcessor>> = {}

async function getReactProcessor(mode: ThemeMode): Promise<ReactProcessor> {
  if (!PROCESSORS[mode]) {
    const themeName = THEME_BY_MODE[mode] ?? 'vitesse-light'

    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeSanitize, SANITIZE_SCHEMA)
      .use(rehypeProtectMermaid)
      .use(rehypeShiki as unknown as (this: unknown, ...args: [RehypeShikiOptions]) => void, {
        theme: themeName,
        langs: REHYPE_LANGS
      } satisfies RehypeShikiOptions)
      .use(rehypeWrapEmoji)
      .use(rehypeReact, {
        jsx,
        jsxs,
        Fragment
      })

    PROCESSORS[mode] = async (markdown: string) => {
      const file = await processor.process(markdown)
      return file.result as ReactNode
    }
  }

  return PROCESSORS[mode]!
}

export async function renderMarkdownToReact(
  markdown: string,
  mode: ThemeMode = 'light'
): Promise<ReactNode> {
  const run = await getReactProcessor(mode)
  return run(markdown)
}

export async function preloadReactRenderers(modes: ThemeMode[] = ['light', 'dark']): Promise<void> {
  await Promise.all(modes.map((mode) => getReactProcessor(mode)))
}
