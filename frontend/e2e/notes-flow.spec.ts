import { expect, test } from '@playwright/test'
import { installApiMock } from './mock'

test('logs in and lands on the dashboard', async ({ page }) => {
  await installApiMock(page)
  await page.goto('/login')

  await page.getByLabel('Username').fill('tester')
  await page.locator('input[type="password"]').fill('pw-secret-123')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('heading', { name: 'All notes' })).toBeVisible()
})

test('creates a note and autosaves edits', async ({ page }) => {
  await installApiMock(page, { loggedIn: true })
  await page.goto('/')

  await page.getByRole('button', { name: '+ New note' }).click()
  await expect(page).toHaveURL(/\/note\/\d+$/)

  // Typing the title fires a debounced PATCH; assert the payload reaches the API.
  const patch = page.waitForRequest(
    (r) => /\/api\/notes\/\d+\/$/.test(r.url()) && r.method() === 'PATCH',
  )
  await page.getByPlaceholder('Untitled').fill('Shopping list')
  const req = await patch
  expect(req.postDataJSON()).toMatchObject({ title: 'Shopping list' })

  await expect(page.getByText('Saved')).toBeVisible()
})

test('toggling public sends is_public to the server', async ({ page }) => {
  await installApiMock(page, { loggedIn: true })
  await page.goto('/')
  await page.getByRole('button', { name: '+ New note' }).click()
  await expect(page).toHaveURL(/\/note\/\d+$/)

  const patch = page.waitForRequest(
    (r) =>
      /\/api\/notes\/\d+\/$/.test(r.url()) &&
      r.method() === 'PATCH' &&
      r.postDataJSON()?.is_public === true,
  )
  // Single click (not .check, which re-clicks until checked and would race the
  // 800ms autosave debounce, toggling the flag back off).
  await page.getByRole('checkbox', { name: 'Public' }).click()
  await patch // resolves only if the public flag was sent

  // The editor re-reads is_public from the patched single-note cache, so the
  // share UI appears without a reload (regression guard for the staleness fix).
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Public' })).toBeChecked()
})

test('trashing a note removes it from the dashboard', async ({ page }) => {
  await installApiMock(page, { loggedIn: true })
  page.on('dialog', (d) => d.accept()) // confirm("Move this note to the trash?")
  await page.goto('/')

  await page.getByRole('button', { name: '+ New note' }).click()
  await expect(page).toHaveURL(/\/note\/\d+$/)

  await page.getByRole('button', { name: 'Trash' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('No notes here yet', { exact: false })).toBeVisible()
})
