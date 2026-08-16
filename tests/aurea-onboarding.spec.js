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
  await expect(page.locator('#public-price-list .public-price-card')).toHaveCount(7);
  await expect(page.locator('#public-price-list .public-price-row')).toHaveCount(24);
  await expect(page.locator('#view-prices')).toContainText('no modifica inventario, costos ni ventas');
  await expect(page.locator('#view-prices')).toContainText('Detalle en oro laminado 18K');
  await expect(page.locator('#view-prices')).toContainText('Balín en oro 18K');
  await expect(page.locator('#view-prices')).toContainText('142.000');

  await page.locator('#public-price-line').selectOption('certified');
  await expect(page.locator('#public-price-list .public-price-card')).toHaveCount(2);
  await expect(page.locator('#public-price-list')).toContainText('Disponible liso o diamantado al mismo precio');

  await page.locator('#public-price-line').selectOption('');
  await page.locator('#public-price-search').fill('italiano');
  await expect(page.locator('#public-price-list .public-price-card')).toHaveCount(1);
  await expect(page.locator('#public-price-list')).toContainText('6 mm agotado');

  await page.locator('#public-price-search').fill('');
  await page.locator('.public-poster-card summary').click();
  await expect(page.locator('#price-poster-canvas')).toBeVisible();
  await expect.poll(() => page.locator('#price-poster-canvas').evaluate(canvas => canvas.width)).toBe(1080);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/aurea-public-prices-mobile.png', fullPage: true });
});

test('el afiche se genera desde los precios guardados y se puede descargar', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/');
  await page.locator('[data-view="prices"]').click();
  await page.locator('.public-poster-card summary').click();

  // El afiche de precios por unidad no queda en blanco
  await expect.poll(() => page.locator('#price-poster-canvas').evaluate(canvas => canvas.height)).toBeGreaterThan(1000);
  expect(await page.locator('#price-poster-canvas').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let i = 0; i < data.length; i += 4000) if (data[i] > 40) painted += 1;
    return painted;
  })).toBeGreaterThan(50);

  // Cambiar de afiche redibuja con otro ancho
  await page.getByRole('button', { name: 'Precio de la manilla' }).click();
  await expect.poll(() => page.locator('#price-poster-canvas').evaluate(canvas => canvas.width)).toBe(1240);

  const download = page.waitForEvent('download');
  await page.locator('#download-price-poster-btn').click();
  expect((await download).suggestedFilename()).toContain('aurea-precio-manillas');

  // Al editar un precio, el afiche se vuelve a armar solo
  await page.getByRole('button', { name: 'Precio por balín' }).click();
  const before = await page.locator('#price-poster-canvas').evaluate(canvas => canvas.toDataURL().length);
  await page.locator('.public-price-card').first().getByRole('button', { name: 'Editar' }).click();
  await page.locator('#pf-rows .pf-row').first().locator('.pf-price').fill('999000');
  await page.locator('#modal').getByRole('button', { name: 'Guardar' }).click();
  await expect.poll(() => page.locator('#price-poster-canvas').evaluate(canvas => canvas.toDataURL().length)).not.toBe(before);
});

test('la tabla de manilla completa aplica la fórmula del Excel de oro 18K', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/');
  await page.locator('[data-view="prices"]').click();

  // Excel "Manillas comunes": 3 balines #3 = 69.000, 20 balines #8 = 2.855.000
  await expect(page.locator('#bracelet-price-family')).toHaveValue('certificado');
  const goldRows = page.locator('#bracelet-price-table tbody tr');
  await expect(goldRows).toHaveCount(6);
  await expect(goldRows.first().locator('td').first()).toHaveText('$ 69.000');
  await expect(goldRows.last().locator('td').last()).toHaveText('$ 2.855.000');
  await expect(page.locator('#bracelet-price-formula')).toContainText('$ 15.000 de mano de obra');
  await expect(page.locator('#bracelet-price-formula')).toContainText('suma $ 4.000 por cada uno');

  // El neopreno de oro no debe aparecer como fila de manilla completa
  await expect(page.locator('#bracelet-price-family option')).toHaveCount(5);
});

test('los precios al público se pueden editar y quedan guardados', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/');
  await page.locator('[data-view="prices"]').click();

  await page.locator('.public-price-card').first().getByRole('button', { name: 'Editar' }).click();
  await expect(page.locator('#modal')).toContainText('Editar familia de precios');
  await page.locator('#pf-rows .pf-row').first().locator('.pf-price').fill('20000');
  await page.locator('#modal').getByRole('button', { name: 'Guardar' }).click();

  await expect(page.locator('#public-price-list')).toContainText('$ 20.000');
  // 3 balines de 20.000 + 15.000 de mano de obra
  await expect(page.locator('#bracelet-price-table tbody tr').first().locator('td').first()).toHaveText('$ 75.000');

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('aurea_data_v1')).priceCatalog);
  expect(stored.families[0].prices[0]).toEqual(['3 mm', 20000]);

  await expect
    .poll(() => page.evaluate(() => window.__firebaseTest.getStoredData()?.priceCatalog?.families?.[0]?.prices?.[0]?.[1]))
    .toBe(20000);

  await page.reload();
  await page.locator('[data-view="prices"]').click();
  await expect(page.locator('#public-price-list')).toContainText('$ 20.000');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#reset-prices-btn').click();
  await expect(page.locator('#public-price-list')).toContainText('$ 18.000');
});
