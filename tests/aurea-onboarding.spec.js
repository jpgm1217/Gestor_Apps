const { test, expect } = require('@playwright/test');
const { firebaseStub } = require('./helpers/firebase-stub');

test.beforeEach(async ({ page }) => {
  await page.route('https://www.gstatic.com/firebasejs/**', route => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });
  await page.addInitScript(firebaseStub);
  await page.addInitScript(() => sessionStorage.setItem('aurea_unlocked', '1'));
});

test('la guía inicial explica el flujo y lleva a cada tarea sin bloquear la app', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/');

  await expect(page.locator('#getting-started')).toBeVisible();
  await expect(page.locator('#setup-checklist .setup-task')).toHaveCount(5);
  await expect(page.locator('#setup-progress-text')).toHaveText('0 de 5 pasos');
  await expect(page.locator('#getting-started')).toContainText('Cargar los materiales que ya tienes');
  await expect(page.locator('#getting-started')).toContainText('Registrar la primera venta');
  await page.locator('#getting-started').screenshot({ path: 'test-results/aurea-guide-desktop.png' });

  await page.locator('#open-user-guide-btn').click();
  await expect(page.locator('#modal')).toContainText('¿Qué debo hacer en Aurea?');
  await expect(page.locator('#modal')).toContainText('Cuando compras materiales');
  await expect(page.locator('#modal')).toContainText('Cuando te pagan después');
  await expect(page.locator('#modal')).toContainText('Al terminar el día');

  await page.getByRole('button', { name: 'Comenzar por inventario' }).click();
  await expect(page.locator('#view-inventory')).toHaveClass(/active/);
  await expect(page.locator('#view-inventory .guided-tip')).toContainText('¿Qué hago aquí?');

  await page.locator('[data-view="home"]').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar', exact: true }).click();
  await downloadPromise;
  await expect(page.locator('#setup-progress-text')).toHaveText('1 de 5 pasos');
  await expect(page.locator('#setup-checklist .setup-task').last()).toContainText('Último respaldo');
});

test('la guía se puede usar cómodamente desde un celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/aurea/');

  await expect(page.locator('#getting-started')).toBeVisible();
  await expect(page.locator('#open-user-guide-btn')).toBeVisible();
  await expect(page.locator('#setup-checklist .setup-task').first().getByRole('button')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/aurea-guide-mobile.png', fullPage: true });

  await page.locator('#open-full-guide-btn').click();
  await expect(page.locator('#modal')).toBeVisible();
  await expect(page.locator('#modal')).toContainText('No necesitas aprender todo el primer día');
});

test('la lista de precios públicos es fácil de consultar y no se mezcla con inventario', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/aurea/');

  await page.locator('[data-view="prices"]').click();
  await expect(page.locator('#view-prices')).toHaveClass(/active/);
  await expect(page.locator('#public-price-list .public-price-card')).toHaveCount(6);
  await expect(page.locator('#public-price-list .public-price-row')).toHaveCount(23);
  await expect(page.locator('#view-prices')).toContainText('Esta lista no modifica inventario, costos ni ventas');
  await expect(page.locator('#view-prices')).toContainText('Detalle en oro laminado 18K');
  await expect(page.locator('#view-prices')).toContainText('Balín en oro 18K certificado');
  await expect(page.locator('#view-prices')).toContainText('203.000');

  await page.locator('#public-price-line').selectOption('certified');
  await expect(page.locator('#public-price-list .public-price-card')).toHaveCount(1);
  await expect(page.locator('#public-price-list')).toContainText('Disponible liso o diamantado al mismo precio');

  await page.locator('#public-price-line').selectOption('');
  await page.locator('#public-price-search').fill('italiano');
  await expect(page.locator('#public-price-list .public-price-card')).toHaveCount(1);
  await expect(page.locator('#public-price-list')).toContainText('6 mm agotado');

  await page.locator('#public-price-search').fill('');
  await page.locator('.public-poster-card').click();
  await expect(page.locator('.public-poster-card img')).toBeVisible();
  await expect.poll(() => page.locator('.public-poster-card img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/aurea-public-prices-mobile.png', fullPage: true });
});
