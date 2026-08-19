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
  await expect(page.locator('#public-price-list .public-price-card')).toHaveCount(8);
  await expect(page.locator('#public-price-list .public-price-row')).toHaveCount(30);
  await expect(page.locator('#view-prices')).toContainText('no modifica inventario, costos ni ventas');
  await expect(page.locator('#view-prices')).toContainText('Detalle en oro laminado 18K');
  await expect(page.locator('#view-prices')).toContainText('Balín en oro 18K');
  await expect(page.locator('#view-prices')).toContainText('130.000');

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

test('la tabla de manilla completa aplica la fórmula de oro 18K', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/');
  await page.locator('[data-view="prices"]').click();

  // 3 balines #3 = 3 x 18.000 + 15.000 | 20 balines #8 = 20 x 130.000 + 15.000
  await expect(page.locator('#bracelet-price-family')).toHaveValue('certificado');
  const goldRows = page.locator('#bracelet-price-table tbody tr');
  await expect(goldRows).toHaveCount(6);
  await expect(goldRows.first().locator('td').first()).toHaveText('$ 69.000');
  await expect(goldRows.last().locator('td').last()).toHaveText('$ 2.615.000');
  await expect(page.locator('#bracelet-price-formula')).toContainText('$ 15.000 de mano de obra');
  await expect(page.locator('#bracelet-price-formula')).toContainText('suma $ 6.500 por cada uno');

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

test('la manilla San Benito suma el dije y el adicional es parametrizable', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/');
  await page.locator('[data-view="prices"]').click();

  const benito = page.locator('[data-price-model="san-benito"]');
  const nudos = page.locator('[data-price-model="siete-nudos"]');
  const cell = (card, size, qty) => card.locator(`[data-model-family="certificado"] td[data-size="${size}"][data-qty="${qty}"]`);

  // 7 Nudos no lleva dije: 6 balines de 8 mm = 6 x 142.000 + 15.000 mano de obra
  await expect(cell(nudos, '8 mm', 6)).toHaveText('$ 795.000');

  // San Benito suma 15.000 del dije encima de lo mismo
  await expect(cell(benito, '8 mm', 6)).toHaveText('$ 810.000');
  await expect(cell(benito, '3 mm', 2)).toHaveText('$ 66.000');
  await expect(benito.locator('.model-price-formula')).toContainText('Dije San Benito');

  // El dije cambia por tamaño de balín y la tabla se recalcula sola
  await page.locator('#public-price-line').selectOption('addon');
  await expect(page.locator('#public-price-list .public-price-card')).toHaveCount(1);
  await page.locator('#public-price-list').getByRole('button', { name: 'Editar' }).click();
  const rows = page.locator('#pf-rows .pf-row');
  await rows.nth(0).locator('.pf-price').fill('12000');   // 3 mm
  await rows.nth(5).locator('.pf-price').fill('30000');   // 8 mm
  await page.locator('#modal').getByRole('button', { name: 'Guardar' }).click();

  await expect(cell(benito, '3 mm', 2)).toHaveText('$ 63.000');
  await expect(cell(benito, '8 mm', 6)).toHaveText('$ 825.000');
  await expect(cell(nudos, '8 mm', 6)).toHaveText('$ 795.000');
  await expect(benito.locator('.model-price-formula')).toContainText('$ 12.000 a $ 30.000');

  // Se puede quitar el dije del modelo desde el editor
  await benito.getByRole('button', { name: 'Editar' }).click();
  await page.locator('.pm-addon[value="dije-san-benito"]').uncheck();
  await page.locator('#modal').getByRole('button', { name: 'Guardar' }).click();
  await expect(cell(benito, '8 mm', 6)).toHaveText('$ 795.000');
});

test('el dije se siembra en catálogos ya guardados sin pisar lo editado', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/');

  // Estado como el que ya está en Firebase: con familias y modelos guardados, sin dije
  const guardado = {
    priceCatalog: {
      labor: 15000,
      quantities: [3, 5, 7],
      families: [{
        id: 'certificado', name: 'Balín en oro 18K', material: 'Oro', line: 'certified',
        bead: 'certificado', note: '', braceletTable: true,
        prices: [['3 mm', 18000], ['8 mm', 142000]]
      }],
      models: [{ id: 'san-benito', name: 'Manilla San Benito', note: '', quantities: [2, 16] }]
    }
  };

  const migrado = await page.evaluate(v => window.AureaDiagnostics.normalizeState(v), guardado);
  const dije = migrado.priceCatalog.families.find(f => f.id === 'dije-san-benito');
  expect(dije).toBeTruthy();
  expect(dije.prices).toEqual([['3 mm', 15000], ['4 mm', 15000], ['5 mm', 15000], ['6 mm', 15000], ['7 mm', 15000], ['8 mm', 15000]]);
  expect(migrado.priceCatalog.models[0].addons).toEqual(['dije-san-benito']);
  // No inventó familias de fábrica que el usuario no tenía
  expect(migrado.priceCatalog.families.map(f => f.id)).toEqual(['certificado', 'dije-san-benito']);

  // Idempotente: normalizar otra vez no duplica nada
  const otraVez = await page.evaluate(v => window.AureaDiagnostics.normalizeState(v), migrado);
  expect(otraVez.priceCatalog).toEqual(migrado.priceCatalog);

  // Si el usuario borra el dije después, no se lo devolvemos
  const sinDije = JSON.parse(JSON.stringify(migrado));
  sinDije.priceCatalog.families = sinDije.priceCatalog.families.filter(f => f.id !== 'dije-san-benito');
  const respetado = await page.evaluate(v => window.AureaDiagnostics.normalizeState(v), sinDije);
  expect(respetado.priceCatalog.families.some(f => f.id === 'dije-san-benito')).toBe(false);

  // Y si edita el precio, la siembra no lo pisa
  const editado = JSON.parse(JSON.stringify(migrado));
  editado.priceCatalog.families.find(f => f.id === 'dije-san-benito').prices = [['3 mm', 99000]];
  const conservado = await page.evaluate(v => window.AureaDiagnostics.normalizeState(v), editado);
  expect(conservado.priceCatalog.families.find(f => f.id === 'dije-san-benito').prices).toEqual([['3 mm', 99000]]);
});

test('el dije se edita desde la manilla y hay afiche por modelo', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/');
  await page.locator('[data-view="prices"]').click();

  const benito = page.locator('[data-price-model="san-benito"]');
  const cell = (card, size, qty) => card.locator(`[data-model-family="certificado"] td[data-size="${size}"][data-qty="${qty}"]`);

  // El dije se edita tocando el chip de la propia manilla, sin buscar en los filtros
  const chip = benito.locator('.model-addon-chip');
  await expect(chip).toContainText('Dije San Benito');
  await chip.click();
  await expect(page.locator('#modal')).toContainText('Editar familia de precios');
  await page.locator('#pf-rows .pf-row').first().locator('.pf-price').fill('20000');
  await page.locator('#modal').getByRole('button', { name: 'Guardar' }).click();
  // 2 balines de 3 mm: 2 x 18.000 + 15.000 mano de obra + 20.000 dije
  await expect(cell(benito, '3 mm', 2)).toHaveText('$ 71.000');

  // Crear un dije nuevo arranca con los tamaños del balín ya puestos
  await page.locator('#add-price-addon-btn').click();
  await expect(page.locator('#pf-line')).toHaveValue('addon');
  await expect(page.locator('#pf-rows .pf-row')).toHaveCount(6);
  await page.locator('#pf-name').fill('Dije Virgen');
  await page.locator('#pf-rows .pf-row').first().locator('.pf-price').fill('9000');
  await page.locator('#modal').getByRole('button', { name: 'Guardar' }).click();

  // Y se puede marcar en cualquier modelo
  await page.locator('[data-price-model="siete-nudos"]').getByRole('button', { name: 'Editar' }).click();
  await page.locator('.pm-addon-row', { hasText: 'Dije Virgen' }).locator('.pm-addon').check();
  await page.locator('#modal').getByRole('button', { name: 'Guardar' }).click();
  // 6 balines de 3 mm: 6 x 18.000 + 15.000 + 9.000
  await expect(cell(page.locator('[data-price-model="siete-nudos"]'), '3 mm', 6)).toHaveText('$ 132.000');

  // Afiche por modelo
  await page.locator('.public-poster-card summary').click();
  await page.getByRole('button', { name: 'Por modelo' }).click();
  await expect(page.locator('#poster-pickers')).toBeVisible();
  await page.locator('#poster-model').selectOption('san-benito');
  await expect.poll(() => page.locator('#price-poster-canvas').evaluate(c => c.height)).toBeGreaterThan(900);
  const download = page.waitForEvent('download');
  await page.locator('#download-price-poster-btn').click();
  expect((await download).suggestedFilename()).toContain('manilla-san-benito');
});
