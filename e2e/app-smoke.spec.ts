import { expect, test as base, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import path from 'node:path'

type Fixtures = {
  electronApp: ElectronApplication
  page: Page
}

const test = base.extend<Fixtures>({
  electronApp: async ({}, apply) => {
    const mainPath = path.resolve(process.cwd(), 'dist/desktop/main/index.cjs')
    const app = await electron.launch({
      args: [mainPath],
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    })
    await apply(app)
    await app.close()
  },
  page: async ({ electronApp }, apply) => {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await apply(page)
  }
})

test('settings page uses left-right layout', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.getByTitle('全局设置').click()
  await expect(page.getByRole('heading', { name: '设置导航' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '通用设置' })).toBeVisible()

  const leftHeader = page.getByRole('heading', { name: '设置导航' })
  const rightHeader = page.getByRole('heading', { name: '通用设置' })
  const [leftBox, rightBox] = await Promise.all([
    leftHeader.boundingBox(),
    rightHeader.boundingBox()
  ])

  expect(leftBox).not.toBeNull()
  expect(rightBox).not.toBeNull()
  expect(Math.abs(leftBox!.x - rightBox!.x)).toBeGreaterThan(80)
})

test('model settings render provider cards with ping buttons', async ({ page }) => {
  await page.getByTitle('全局设置').click()
  await page.getByRole('button', { name: '模型' }).first().click()

  await expect(page.getByRole('heading', { name: '模型配置' }).first()).toBeVisible()
  const pingButtons = page.getByRole('button', { name: 'Ping' })
  await expect(pingButtons.first()).toBeVisible()
  expect(await pingButtons.count()).toBeGreaterThanOrEqual(6)
})

test('chat page exposes model selector options', async ({ page }) => {
  await page.getByTitle('聊天').click()
  await expect(page.getByText('聊天页面')).toBeVisible()

  const modelSelect = page.locator('select').first()
  await expect(modelSelect).toBeVisible()
  const optionCount = await modelSelect.locator('option').count()
  expect(optionCount).toBeGreaterThan(3)
})

test('chat message send persists session snapshot through main ipc', async ({ page }) => {
  const message = 'e2e persistence ping'

  await page.getByTitle('全局设置').click()
  await page.getByRole('button', { name: '模型' }).first().click()

  const apiKeyInput = page.locator('input[placeholder="请输入当前 Provider 的 Key"]').first()
  await expect(apiKeyInput).toBeVisible()
  if (!(await apiKeyInput.inputValue())) {
    await apiKeyInput.fill('e2e-dummy-key')
  }

  const saveButton = page.getByRole('button', { name: /保存设置|Save Settings/ }).first()
  if (await saveButton.isEnabled()) {
    await saveButton.click()
    await expect(page.getByText(/模型配置已保存|Model settings saved/)).toBeVisible()
  }

  await page.getByTitle('聊天').click()
  await expect(page.getByText('聊天页面')).toBeVisible()

  const textarea = page.locator('message-editor textarea').first()
  await expect(textarea).toBeVisible()
  await textarea.fill(message)
  await textarea.press('Enter')

  await expect(page.getByText(message)).toBeVisible()

  await page.waitForTimeout(500)
  const persisted = await page.evaluate(async (expectedMessage) => {
    const api = (window as unknown as { api: any }).api
    const summary = await api.settings.resolveActiveModel()
    const sessionId = `chat:${summary.providerId}:${summary.modelId}`
    const loaded = await api.chat.loadSession({ sessionId })
    const messages = loaded.snapshot?.state?.messages ?? []

    const containsExpectedMessage = messages.some((entry: any) => {
      const content = entry?.content
      if (typeof content === 'string') {
        return content.includes(expectedMessage)
      }
      if (Array.isArray(content)) {
        return content.some(
          (part: any) =>
            part &&
            part.type === 'text' &&
            typeof part.text === 'string' &&
            part.text.includes(expectedMessage)
        )
      }
      return false
    })

    return {
      sessionId,
      containsExpectedMessage
    }
  }, message)

  expect(persisted.containsExpectedMessage).toBe(true)
})
