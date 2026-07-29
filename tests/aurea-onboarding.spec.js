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
