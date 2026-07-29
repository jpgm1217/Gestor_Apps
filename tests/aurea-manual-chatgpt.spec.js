const { test, expect } = require('@playwright/test');
const { firebaseStub } = require('./helpers/firebase-stub');

const testImage = process.env.AUREA_TEST_IMAGE;
test.beforeEach(async ({ page }) => {
  await page.route('https://www.gstatic.com/firebasejs/**', route => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });
  await page.addInitScript(firebaseStub);
  await page.addInitScript(() => sessionStorage.setItem('aurea_unlocked', '1'));
});

test('prepara, importa, corrige y descarga una presentación', async ({ page }) => {
  test.skip(!testImage, 'AUREA_TEST_IMAGE es obligatorio');

  await page.goto('http://127.0.0.1:4173/aurea/?view=designer');
  await expect(page.locator('#auth-screen')).toHaveClass(/hidden/);
  await expect(page.locator('#pin-screen')).toHaveClass(/hidden/);
  await expect(page.locator('#ai-generate-btn')).toHaveText(/Preparar en ChatGPT/);

  await page.locator('#design-name').fill('Pareja Aurea');
  await page.locator('#design-image-input').setInputFiles(testImage);
  await expect(page.locator('#product-reference-wrap')).toBeVisible();

  await page.locator('#ai-generate-btn').click();
  await expect(page.locator('#modal')).toContainText('Crear la imagen con ChatGPT');
  await expect(page.locator('#modal')).toContainText('Adjunta la foto real del producto');
  await page.getByRole('button', { name: 'Copiar prompt' }).click();
  await expect.poll(() => page.evaluate(() => window.__copiedText)).toContain('OBJETIVO DE ESTA IMAGEN');
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await page.locator('#ai-result-input').setInputFiles(testImage);
  await expect(page.locator('#design-image-wrap')).toBeVisible();
  await expect(page.locator('#ai-chat')).toBeVisible();
  await expect(page.locator('.ai-version')).toHaveCount(1);

  await page.getByRole('button', { name: 'Fondo más elegante' }).click();
  await expect(page.locator('#ai-feedback-input')).toHaveValue(/fondo más elegante/i);
  await page.locator('#ai-refine-btn').click();
  await expect.poll(() => page.evaluate(() => window.__copiedText)).toContain('CAMBIO SOLICITADO');

  await page.locator('#ai-result-input').setInputFiles(testImage);
  await expect(page.locator('.ai-version')).toHaveCount(2);
  await expect(page.locator('#ai-chat-messages')).toContainText('Haz el fondo más elegante');
  await page.locator('#design-image-wrap').screenshot({ path: 'test-results/aurea-manual-result.png' });

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-presentation-btn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^aurea-.*\.jpg$/);
  await download.saveAs('test-results/aurea-download-result.jpg');
});

test('el estudio manual se adapta al celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/aurea/?view=designer');
  await expect(page.locator('#ai-generate-btn')).toBeVisible();
  await expect(page.locator('[data-import-ai-result]').first()).toBeVisible();
  await page.locator('.ai-studio').screenshot({ path: 'test-results/aurea-manual-mobile.png' });
});
