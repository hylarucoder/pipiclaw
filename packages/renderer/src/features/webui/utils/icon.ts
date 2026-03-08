import type { IconNode } from 'lucide'

const ICON_SIZE: Record<string, number> = {
	xs: 12,
	sm: 14,
	md: 16,
	lg: 20,
}

const SVG_NS = 'http://www.w3.org/2000/svg'

function appendIconNodes(svg: SVGElement, node: IconNode) {
	for (const [tag, attrs] of node) {
		const element = document.createElementNS(SVG_NS, tag)
		for (const [key, value] of Object.entries(attrs)) {
			if (value === undefined || value === null) continue
			element.setAttribute(key, String(value))
		}
		svg.appendChild(element)
	}
}

export function renderIcon(
	node: IconNode,
	size: 'xs' | 'sm' | 'md' | 'lg' = 'sm',
	className = '',
): SVGElement {
	const px = ICON_SIZE[size] ?? ICON_SIZE.sm
	const svg = document.createElementNS(SVG_NS, 'svg')
	svg.setAttribute('xmlns', SVG_NS)
	svg.setAttribute('width', String(px))
	svg.setAttribute('height', String(px))
	svg.setAttribute('viewBox', '0 0 24 24')
	svg.setAttribute('fill', 'none')
	svg.setAttribute('stroke', 'currentColor')
	svg.setAttribute('stroke-width', '2')
	svg.setAttribute('stroke-linecap', 'round')
	svg.setAttribute('stroke-linejoin', 'round')
	if (className) {
		svg.setAttribute('class', className)
	}
	appendIconNodes(svg, node)
	return svg
}
