import { expect, test } from '@playwright/test'
import { installApiMock } from './mock'

// Opens a fresh note in the editor and returns once it's ready.
async function openNewNote(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '+ New note' }).click()
  await expect(page).toHaveURL(/\/note\/\d+$/)
}

test('dictation records, transcribes via the server, and inserts the text', async ({ page }) => {
  await installApiMock(page, { loggedIn: true, transcript: 'meeting notes from dictation' })
  await openNewNote(page)

  await page.getByRole('button', { name: 'Dictate' }).click()
  // The button flips to a stop control once recording starts (real fake mic).
  const stop = page.getByRole('button', { name: 'Stop dictation' })
  await expect(stop).toBeVisible()

  await page.waitForTimeout(500) // let MediaRecorder capture a moment of audio
  const post = page.waitForRequest(
    (r) => /\/api\/transcribe\/$/.test(r.url()) && r.method() === 'POST',
  )
  await stop.click()
  await post

  await expect(page.getByPlaceholder('Write in markdown…')).toHaveValue(
    /meeting notes from dictation/,
  )
})

test('offline with no cached model disables download and explains why', async ({ page, context }) => {
  await installApiMock(page, { loggedIn: true })
  await openNewNote(page)

  // Open the dictation settings popover.
  await page.getByRole('button', { name: 'Dictation settings' }).click()
  await expect(page.getByText('not downloaded', { exact: false })).toBeVisible()
  const download = page.getByRole('button', { name: 'Download for offline use' })
  await expect(download).toBeEnabled()

  await context.setOffline(true)
  await expect(download).toBeDisabled()
  await expect(
    page.getByText('Connect to the internet once to download the model.'),
  ).toBeVisible()
})

test('a cached model shows as ready and offers a re-download', async ({ page }) => {
  // Seed the persisted voice store so the model reads as already downloaded.
  await page.addInitScript(() => {
    localStorage.setItem(
      'turbo-voice',
      JSON.stringify({
        state: { language: 'auto', model: 'Xenova/whisper-tiny', modelReady: true },
        version: 0,
      }),
    )
  })
  await installApiMock(page, { loggedIn: true })
  await openNewNote(page)

  await page.getByRole('button', { name: 'Dictation settings' }).click()
  await expect(page.getByText('ready ✓', { exact: false })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Re-download offline model' }),
  ).toBeVisible()
})
