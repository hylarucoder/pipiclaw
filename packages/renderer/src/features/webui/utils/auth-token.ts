import { i18n } from './i18n.js'

function askForSecret(title: string, message: string): Promise<string | undefined> {
	return new Promise((resolve) => {
		const overlay = document.createElement('div')
		overlay.style.cssText = `
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.45);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 99999;
		`

		const dialog = document.createElement('div')
		dialog.style.cssText = `
			width: min(420px, 92vw);
			background: hsl(var(--background, 0 0% 100%));
			color: hsl(var(--foreground, 222.2 84% 4.9%));
			border: 1px solid hsl(var(--border, 214.3 31.8% 91.4%));
			border-radius: 12px;
			padding: 16px;
			box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
		`

		const titleEl = document.createElement('h2')
		titleEl.textContent = title
		titleEl.style.cssText = 'margin: 0 0 8px 0; font-size: 16px; font-weight: 600;'

		const messageEl = document.createElement('p')
		messageEl.textContent = message
		messageEl.style.cssText = 'margin: 0 0 12px 0; font-size: 14px; opacity: 0.85;'

		const input = document.createElement('input')
		input.type = 'password'
		input.autocomplete = 'off'
		input.style.cssText = `
			width: 100%;
			box-sizing: border-box;
			padding: 10px 12px;
			border-radius: 8px;
			border: 1px solid hsl(var(--input, 214.3 31.8% 91.4%));
			background: hsl(var(--background, 0 0% 100%));
			color: inherit;
			margin-bottom: 12px;
			outline: none;
		`

		const actions = document.createElement('div')
		actions.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;'

		const cancelButton = document.createElement('button')
		cancelButton.type = 'button'
		cancelButton.textContent = i18n('Cancel')
		cancelButton.style.cssText = `
			padding: 8px 12px;
			border-radius: 8px;
			border: 1px solid hsl(var(--border, 214.3 31.8% 91.4%));
			background: transparent;
			color: inherit;
			cursor: pointer;
		`

		const confirmButton = document.createElement('button')
		confirmButton.type = 'button'
		confirmButton.textContent = i18n('Confirm')
		confirmButton.style.cssText = `
			padding: 8px 12px;
			border-radius: 8px;
			border: 1px solid transparent;
			background: hsl(var(--primary, 222.2 47.4% 11.2%));
			color: hsl(var(--primary-foreground, 210 40% 98%));
			cursor: pointer;
		`

		let settled = false
		const cleanup = (value: string | undefined) => {
			if (settled) return
			settled = true
			overlay.remove()
			resolve(value)
		}

		cancelButton.addEventListener('click', () => cleanup(undefined))
		confirmButton.addEventListener('click', () => cleanup(input.value))
		overlay.addEventListener('click', (event) => {
			if (event.target === overlay) {
				cleanup(undefined)
			}
		})
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault()
				cleanup(input.value)
			}
			if (event.key === 'Escape') {
				event.preventDefault()
				cleanup(undefined)
			}
		})

		actions.append(cancelButton, confirmButton)
		dialog.append(titleEl, messageEl, input, actions)
		overlay.appendChild(dialog)
		document.body.appendChild(overlay)

		requestAnimationFrame(() => input.focus())
	})
}

export async function getAuthToken(): Promise<string | undefined> {
	let authToken: string | undefined = localStorage.getItem('auth-token') || ''
	if (authToken) return authToken

	while (true) {
		authToken = (await askForSecret(i18n('Enter Auth Token'), i18n('Please enter your auth token.')))?.trim()
		if (authToken) {
			localStorage.setItem('auth-token', authToken)
			break
		}
	}
	return authToken?.trim() || undefined
}

export async function clearAuthToken() {
	localStorage.removeItem('auth-token')
}
