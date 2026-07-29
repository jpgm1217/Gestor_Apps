const { test, expect } = require('@playwright/test');
const { firebaseStub } = require('./helpers/firebase-stub');

function state(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('aurea_data_v1')));
}

async function buy(page, materialId, quantity, total) {
  await page.evaluate(id => window.openPurchase(id), materialId);
  await page.locator('#p-qty').fill(String(quantity));
  await page.locator('#p-total').fill(String(total));
  await page.locator('#p-shipping').fill('0');
  await page.evaluate(() => window.savePurchase());
}

async function createDesign(page, { name = 'Manilla estándar negra', materialId = 'italiano-3', quantity = 10 } = {}) {
  await page.locator('[data-view="designer"]').click();
  await page.locator('#design-name').fill(name);
  await page.locator('#component-material').selectOption(materialId);
  await page.locator('#component-qty').fill(String(quantity));
  await page.locator('#add-component-btn').click();
  await page.locator('#save-design-btn').click();
  const current = await state(page);
  return current.designs.at(-1);
}

test.beforeEach(async ({ page }) => {
  await page.route('https://www.gstatic.com/firebasejs/**', route => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });
  await page.addInitScript(firebaseStub);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.setItem('aurea_unlocked', '1');
  });
});

test('compra, fabrica, vende dos, abona, cancela y anula el lote sin corromper inventarios', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/?view=inventory');
  await expect(page.locator('#auth-screen')).toHaveClass(/hidden/);

  await buy(page, 'italiano-3', 100, 180000);
  const design = await createDesign(page);

  let current = await state(page);
  expect(current.schemaVersion).toBe(2);
  expect(design.sku).toMatch(/^AUR-/);
  expect(design.finishedStock).toBe(0);
  expect(current.materials.find(item => item.id === 'italiano-3').stock).toBe(100);

  await page.evaluate(id => window.openProduction(id), design.id);
  await page.locator('#prod-qty').fill('3');
  await page.evaluate(() => window.saveProduction());

  current = await state(page);
  expect(current.materials.find(item => item.id === 'italiano-3').stock).toBe(70);
  expect(current.designs[0].finishedStock).toBe(3);
  expect(current.productions).toHaveLength(1);
  expect(current.productions[0].unitCost).toBe(38900);
  expect(current.productions[0].availableQuantity).toBe(3);

  await page.evaluate(() => window.openSale());
  await page.locator('#s-quantity').fill('2');
  await page.locator('#s-price').fill('50000');
  await page.locator('#s-mode').selectOption('finished-product');
  await page.locator('#s-initial-payment').fill('20000');
  await page.evaluate(() => window.saveSale());

  current = await state(page);
  expect(current.materials.find(item => item.id === 'italiano-3').stock).toBe(70);
  expect(current.designs[0].finishedStock).toBe(1);
  expect(current.sales[0].quantity).toBe(2);
  expect(current.sales[0].total).toBe(100000);
  expect(current.sales[0].totalCost).toBe(77800);
  expect(current.sales[0].paymentStatus).toBe('Abono');
  expect(current.sales[0].payments[0].amount).toBe(20000);

  await page.evaluate(id => window.openPayment(id), current.sales[0].id);
  await page.locator('#pay-amount').fill('80000');
  await page.evaluate(id => window.savePayment(id), current.sales[0].id);
  current = await state(page);
  expect(current.sales[0].paymentStatus).toBe('Pagado');
  expect(current.sales[0].payments).toHaveLength(2);

  await page.evaluate(id => window.openCancelSale(id), current.sales[0].id);
  await page.evaluate(id => window.confirmCancelSale(id), current.sales[0].id);
  current = await state(page);
  expect(current.sales[0].status).toBe('Cancelada');
  expect(current.sales[0].refunds[0].amount).toBe(100000);
  expect(current.designs[0].finishedStock).toBe(3);
  expect(current.materials.find(item => item.id === 'italiano-3').stock).toBe(70);

  page.once('dialog', dialog => dialog.accept());
  await page.evaluate(id => window.annulProduction(id), current.productions[0].id);
  current = await state(page);
  expect(current.productions[0].status).toBe('Anulada');
  expect(current.designs[0].finishedStock).toBe(0);
  expect(current.materials.find(item => item.id === 'italiano-3').stock).toBe(100);
});

test('una fabricación con faltantes falla completa y no deja movimientos parciales', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/?view=inventory');
  await buy(page, 'italiano-3', 5, 9000);
  const design = await createDesign(page);
  const before = await state(page);

  await page.evaluate(id => window.openProduction(id), design.id);
  await page.locator('#prod-qty').fill('1');
  await page.evaluate(() => window.saveProduction());

  const after = await state(page);
  expect(after.materials.find(item => item.id === 'italiano-3').stock).toBe(5);
  expect(after.productions).toHaveLength(0);
  expect(after.designs[0].finishedStock).toBe(0);
  expect(after.movements).toHaveLength(before.movements.length);
  await expect(page.locator('#toast')).toContainText('Stock insuficiente');
});

test('una receta histórica repetida agrupa el consumo y nunca oculta stock negativo', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/');
  const result = await page.evaluate(() => {
    const state = {
      settings: { packaging: 0, labor: 0, wastePct: 0 },
      materials: [{ id: 'material-1', name: 'Balín', unit: 'unidad', stock: 5, cost: 1000 }],
      designs: [{
        id: 'design-1',
        sku: 'AUR-001',
        name: 'Receta repetida',
        active: true,
        finishedStock: 0,
        components: [
          { materialId: 'material-1', qty: 3 },
          { materialId: 'material-1', qty: 3 }
        ]
      }],
      productions: [],
      movements: []
    };
    const available = window.AureaDomain.productionAvailability(state, state.designs[0]);
    const outcome = window.AureaDomain.applyProduction(state, {
      operationId: 'op-duplicate-recipe',
      productionId: 'production-1',
      designId: 'design-1',
      quantity: 1,
      source: 'Fabricación',
      date: '2026-07-29',
      createdAt: 1
    });
    return { available, outcome, state };
  });

  expect(result.available).toBe(0);
  expect(result.outcome.ok).toBe(false);
  expect(result.state.materials[0].stock).toBe(5);
  expect(result.state.productions).toHaveLength(0);
  expect(result.state.movements).toHaveLength(0);
});

test('un doble clic de fabricación crea un solo lote', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/?view=inventory');
  await buy(page, 'italiano-3', 30, 54000);
  const design = await createDesign(page, { quantity: 5 });
  await page.evaluate(id => window.openProduction(id), design.id);
  await page.evaluate(() => Promise.all([window.saveProduction(), window.saveProduction()]));

  const current = await state(page);
  expect(current.productions).toHaveLength(1);
  expect(current.materials.find(item => item.id === 'italiano-3').stock).toBe(25);
  expect(current.designs[0].finishedStock).toBe(1);
});

test('un reintento tras perder respuesta y verificación reutiliza la misma operación', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/?view=inventory');
  await buy(page, 'italiano-3', 30, 54000);
  const design = await createDesign(page, { quantity: 5 });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__firebaseTest.failNextCommittedResponseAndReads(1));

  await page.evaluate(id => window.openProduction(id), design.id);
  await page.evaluate(() => window.saveProduction());
  await expect(page.locator('#toast')).toContainText('No fue posible confirmar');
  expect((await state(page)).productions).toHaveLength(0);
  expect((await page.evaluate(() => window.__firebaseTest.getStoredData())).productions).toHaveLength(1);

  await page.evaluate(() => window.saveProduction());
  const current = await state(page);
  expect(current.productions).toHaveLength(1);
  expect(current.materials.find(item => item.id === 'italiano-3').stock).toBe(25);
  expect(current.designs[0].finishedStock).toBe(1);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('aurea_pending_critical_v1')))).toEqual({});
});

test('una edición normal no se pierde silenciosamente durante una operación crítica', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/?view=inventory');
  await buy(page, 'italiano-3', 30, 54000);
  const design = await createDesign(page, { name: 'Diseño sin carrera', quantity: 5 });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__firebaseTest.setTransactionDelay(250));

  await page.evaluate(id => window.openProduction(id), design.id);
  await page.evaluate(() => {
    window.__criticalPromise = window.saveProduction();
  });
  await page.waitForTimeout(40);
  await page.evaluate(() => {
    document.querySelector('#design-name').value = 'Cambio durante fabricación';
    document.querySelector('#save-design-btn').click();
  });
  await expect(page.locator('#toast')).toContainText('Espera a que termine');
  await page.evaluate(() => window.__criticalPromise);

  const current = await state(page);
  expect(current.designs[0].name).toBe('Diseño sin carrera');
  expect(current.productions).toHaveLength(1);
  expect(current.designs[0].finishedStock).toBe(1);
});

test('el inventario inicial terminado nunca consume ni devuelve materiales', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/?view=inventory');
  await buy(page, 'italiano-3', 30, 54000);
  const design = await createDesign(page, { quantity: 5 });

  await page.evaluate(id => window.openInitialFinishedStock(id), design.id);
  await page.locator('#initial-qty').fill('3');
  await page.locator('#initial-cost').fill('25000');
  await page.evaluate(id => window.saveInitialFinishedStock(id), design.id);

  let current = await state(page);
  expect(current.materials.find(item => item.id === 'italiano-3').stock).toBe(30);
  expect(current.designs[0].finishedStock).toBe(3);
  expect(current.productions).toHaveLength(1);
  expect(current.productions[0].source).toBe('Inventario inicial');
  expect(current.productions[0].componentsSnapshot).toEqual([]);

  page.once('dialog', dialog => dialog.accept());
  await page.evaluate(id => window.annulProduction(id), current.productions[0].id);
  current = await state(page);
  expect(current.materials.find(item => item.id === 'italiano-3').stock).toBe(30);
  expect(current.designs[0].finishedStock).toBe(0);
  expect(current.productions[0].status).toBe('Anulada');
});

test('los costos quedan congelados por lote aunque cambie el costo promedio del material', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/?view=inventory');
  await buy(page, 'italiano-3', 100, 180000);
  const design = await createDesign(page);

  await page.evaluate(id => window.openProduction(id), design.id);
  await page.evaluate(() => window.saveProduction());
  let current = await state(page);
  const firstCost = current.productions[0].unitCost;
  expect(firstCost).toBe(38900);

  await page.locator('[data-view="inventory"]').click();
  await buy(page, 'italiano-3', 100, 360000);
  await page.evaluate(id => window.openProduction(id), design.id);
  await page.evaluate(() => window.saveProduction());

  current = await state(page);
  expect(current.productions[0].unitCost).toBe(firstCost);
  expect(current.productions[1].unitCost).toBeGreaterThan(firstCost);

  await page.evaluate(() => window.openSale());
  await page.locator('#s-mode').selectOption('finished-product');
  await page.locator('#s-quantity').fill('2');
  await page.locator('#s-price').fill('60000');
  await page.evaluate(() => window.saveSale());
  current = await state(page);
  expect(current.sales[0].lotAllocations.map(item => item.productionId)).toEqual([
    current.productions[0].id,
    current.productions[1].id
  ]);
  expect(current.sales[0].totalCost).toBeCloseTo(
    current.productions[0].unitCost + current.productions[1].unitCost,
    5
  );
  expect(current.designs[0].finishedStock).toBe(0);
});

test('fabricar y vender bajo pedido deja stock terminado neto cero y registros separados', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/?view=inventory');
  await buy(page, 'italiano-3', 100, 180000);
  await createDesign(page);

  await page.evaluate(() => window.openSale());
  await page.locator('#s-mode').selectOption('make-to-order');
  await page.locator('#s-quantity').fill('2');
  await page.locator('#s-price').fill('50000');
  await page.evaluate(() => window.saveSale());

  const current = await state(page);
  expect(current.materials.find(item => item.id === 'italiano-3').stock).toBe(80);
  expect(current.designs[0].finishedStock).toBe(0);
  expect(current.productions).toHaveLength(1);
  expect(current.productions[0].availableQuantity).toBe(0);
  expect(current.sales).toHaveLength(1);
  expect(current.sales[0].inventoryMode).toBe('make-to-order');
  expect(current.sales[0].productionId).toBe(current.productions[0].id);
});

test('un abono registrado por error se anula sin borrar su trazabilidad', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/?view=inventory');
  await buy(page, 'italiano-3', 30, 54000);
  await createDesign(page, { quantity: 5 });

  await page.evaluate(() => window.openSale());
  await page.locator('#s-mode').selectOption('make-to-order');
  await page.locator('#s-price').fill('50000');
  await page.locator('#s-initial-payment').fill('20000');
  await page.evaluate(() => window.saveSale());

  let current = await state(page);
  const saleId = current.sales[0].id;
  const paymentId = current.sales[0].payments[0].id;
  expect(current.sales[0].paymentStatus).toBe('Abono');

  await page.evaluate(([currentSaleId, currentPaymentId]) => {
    window.openAnnulPayment(currentSaleId, currentPaymentId);
  }, [saleId, paymentId]);
  await page.locator('#payment-annul-reason').fill('Valor cargado a la venta equivocada');
  await page.evaluate(([currentSaleId, currentPaymentId]) => {
    return window.annulPayment(currentSaleId, currentPaymentId);
  }, [saleId, paymentId]);

  current = await state(page);
  expect(current.sales[0].payments).toHaveLength(1);
  expect(current.sales[0].payments[0].status).toBe('Anulado');
  expect(current.sales[0].payments[0].annulReason).toBe('Valor cargado a la venta equivocada');
  expect(current.sales[0].paymentStatus).toBe('Pendiente');
  expect(await page.evaluate(id => window.AureaDomain.paymentSummary(
    JSON.parse(localStorage.getItem('aurea_data_v1')).sales.find(item => item.id === id)
  ), saleId)).toMatchObject({ paid: 0, balance: 50000, status: 'Pendiente' });
});

test('los reversos se rechazan completos cuando falta una referencia histórica', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/');
  const result = await page.evaluate(() => {
    const productionState = {
      materials: [],
      designs: [{ id: 'design-1', finishedStock: 1 }],
      productions: [{
        id: 'production-1',
        designId: 'design-1',
        quantityProduced: 1,
        availableQuantity: 1,
        status: 'Completada',
        componentsSnapshot: [{ materialId: 'missing', name: 'Balín eliminado', totalQty: 2, unitCost: 1000 }]
      }],
      movements: []
    };
    const saleState = {
      materials: [],
      sales: [{
        id: 'sale-1',
        inventoryMode: 'legacy-materials',
        status: 'Registrada',
        total: 10000,
        payments: [],
        refunds: [],
        componentsSnapshot: [{ materialId: 'missing', name: 'Hilo eliminado', qty: 1 }]
      }],
      movements: []
    };
    const productionOutcome = window.AureaDomain.applyAnnulProduction(productionState, {
      operationId: 'op-1', productionId: 'production-1', date: '2026-07-29', createdAt: 1
    });
    const saleOutcome = window.AureaDomain.applyCancelSale(saleState, {
      operationId: 'op-2', saleId: 'sale-1', date: '2026-07-29', createdAt: 2
    });
    const emptyProductionState = {
      materials: [],
      designs: [{ id: 'design-2', finishedStock: 1 }],
      productions: [{
        id: 'production-2', designId: 'design-2', quantityProduced: 1, availableQuantity: 1,
        source: 'Fabricación', status: 'Completada', componentsSnapshot: []
      }],
      movements: []
    };
    const emptyLegacyState = {
      materials: [],
      sales: [{
        id: 'sale-2', inventoryMode: 'legacy-materials', status: 'Registrada', total: 10000,
        payments: [], refunds: [], componentsSnapshot: []
      }],
      movements: []
    };
    const emptyLotsState = {
      materials: [],
      designs: [{ id: 'design-3', finishedStock: 0 }],
      productions: [],
      sales: [{
        id: 'sale-3', designId: 'design-3', quantity: 1, inventoryMode: 'finished-product',
        status: 'Registrada', total: 10000, payments: [], refunds: [], lotAllocations: []
      }],
      movements: []
    };
    const emptyProductionOutcome = window.AureaDomain.applyAnnulProduction(emptyProductionState, {
      operationId: 'op-3', productionId: 'production-2', date: '2026-07-29', createdAt: 3
    });
    const emptyLegacyOutcome = window.AureaDomain.applyCancelSale(emptyLegacyState, {
      operationId: 'op-4', saleId: 'sale-2', date: '2026-07-29', createdAt: 4
    });
    const emptyLotsOutcome = window.AureaDomain.applyCancelSale(emptyLotsState, {
      operationId: 'op-5', saleId: 'sale-3', date: '2026-07-29', createdAt: 5
    });
    const invalidProductionState = {
      materials: [{ id: 'material-1', name: 'Balín', unit: 'unidad', stock: 10, cost: 1000 }],
      designs: [{ id: 'design-4', finishedStock: 1 }],
      productions: [{
        id: 'production-4', designId: 'design-4', quantityProduced: 1, availableQuantity: 1,
        source: 'Fabricación', status: 'Completada',
        componentsSnapshot: [{ materialId: 'material-1', name: 'Balín', totalQty: -2, unitCost: 1000 }]
      }],
      movements: []
    };
    const invalidLegacyState = {
      materials: [{ id: 'material-2', name: 'Hilo', unit: 'metro', stock: 10, cost: 500 }],
      sales: [{
        id: 'sale-4', inventoryMode: 'legacy-materials', status: 'Registrada', total: 10000,
        payments: [], refunds: [],
        componentsSnapshot: [{ materialId: 'material-2', name: 'Hilo', qty: -2 }]
      }],
      movements: []
    };
    const invalidProductionOutcome = window.AureaDomain.applyAnnulProduction(invalidProductionState, {
      operationId: 'op-6', productionId: 'production-4', date: '2026-07-29', createdAt: 6
    });
    const invalidLegacyOutcome = window.AureaDomain.applyCancelSale(invalidLegacyState, {
      operationId: 'op-7', saleId: 'sale-4', date: '2026-07-29', createdAt: 7
    });
    return {
      productionOutcome, saleOutcome, productionState, saleState,
      emptyProductionOutcome, emptyLegacyOutcome, emptyLotsOutcome,
      emptyProductionState, emptyLegacyState, emptyLotsState,
      invalidProductionOutcome, invalidLegacyOutcome, invalidProductionState, invalidLegacyState
    };
  });

  expect(result.productionOutcome.ok).toBe(false);
  expect(result.productionState.productions[0].status).toBe('Completada');
  expect(result.productionState.movements).toHaveLength(0);
  expect(result.saleOutcome.ok).toBe(false);
  expect(result.saleState.sales[0].status).toBe('Registrada');
  expect(result.saleState.movements).toHaveLength(0);
  expect(result.emptyProductionOutcome.ok).toBe(false);
  expect(result.emptyProductionState.productions[0].status).toBe('Completada');
  expect(result.emptyLegacyOutcome.ok).toBe(false);
  expect(result.emptyLegacyState.sales[0].status).toBe('Registrada');
  expect(result.emptyLotsOutcome.ok).toBe(false);
  expect(result.emptyLotsState.sales[0].status).toBe('Registrada');
  expect(result.emptyLotsState.movements).toHaveLength(0);
  expect(result.invalidProductionOutcome.ok).toBe(false);
  expect(result.invalidProductionState.materials[0].stock).toBe(10);
  expect(result.invalidProductionState.productions[0].status).toBe('Completada');
  expect(result.invalidLegacyOutcome.ok).toBe(false);
  expect(result.invalidLegacyState.materials[0].stock).toBe(10);
  expect(result.invalidLegacyState.sales[0].status).toBe('Registrada');
});

test('la migración de datos anteriores es idempotente y conserva la reversión histórica', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/');
  const legacy = {
    settings: { packaging: 5000, labor: 15000, wastePct: 5 },
    materials: [{ id: 'mat-old', name: 'Balín antiguo', category: 'Balín', cost: 1000, stock: 10, minStock: 2 }],
    designs: [{ id: 'des-old', name: 'Diseño anterior', components: [{ materialId: 'mat-old', qty: 2 }], cost: 22000, priceRec: 40000 }],
    sales: [{
      id: 'sale-old', designId: 'des-old', designName: 'Diseño anterior', price: 40000, cost: 22000,
      profit: 18000, paymentStatus: 'Pagado', status: 'Registrada', deductedInventory: true,
      componentsSnapshot: [{ materialId: 'mat-old', qty: 2 }], createdAt: 10
    }],
    purchases: [], movements: [], customers: [], expenses: []
  };
  const migrated = await page.evaluate(value => window.AureaDiagnostics.normalizeState(value), legacy);
  const migratedTwice = await page.evaluate(value => window.AureaDiagnostics.normalizeState(value), migrated);

  expect(migratedTwice).toEqual(migrated);
  expect(migrated.schemaVersion).toBe(2);
  expect(migrated.productions).toEqual([]);
  expect(migrated.designs[0].finishedStock).toBe(0);
  expect(migrated.designs[0].sku).toMatch(/^AUR-/);
  expect(migrated.sales[0].quantity).toBe(1);
  expect(migrated.sales[0].inventoryMode).toBe('legacy-materials');
  expect(migrated.sales[0].payments).toHaveLength(1);
  expect(migrated.sales[0].payments[0].amount).toBe(40000);
});

test('la migración remota usa una transacción y no incrementa de nuevo al recargar', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/aurea/');
  const legacy = {
    settings: { packaging: 5000, labor: 15000, wastePct: 5 },
    materials: [{ id: 'mat-remote', name: 'Balín remoto', category: 'Balín', cost: 1000, stock: 12, minStock: 2 }],
    designs: [],
    sales: [],
    purchases: [],
    movements: [],
    customers: [],
    expenses: []
  };
  await page.evaluate(value => window.__firebaseTest.setStoredData(value), legacy);

  await page.reload();
  await expect(page.locator('#auth-screen')).toHaveClass(/hidden/);
  let remote = await page.evaluate(() => window.__firebaseTest.getStoredData());
  expect(remote.schemaVersion).toBe(2);
  expect(remote.revision).toBe(1);
  expect(remote.materials[0]).toMatchObject({
    id: 'mat-remote',
    stock: 12,
    unit: 'unidad'
  });

  await page.reload();
  await expect(page.locator('#auth-screen')).toHaveClass(/hidden/);
  remote = await page.evaluate(() => window.__firebaseTest.getStoredData());
  expect(remote.schemaVersion).toBe(2);
  expect(remote.revision).toBe(1);
});

test('producción, cartera y respaldo funcionan en una pantalla de celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/aurea/?view=inventory');
  await buy(page, 'italiano-3', 30, 54000);
  await createDesign(page, { name: 'Manilla móvil', quantity: 5 });

  await page.evaluate(() => window.showView('management', 'production'));
  await expect(page.locator('#panel-production')).toBeVisible();
  await expect(page.locator('.product-stock-card')).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.evaluate(id => window.openProduction(id), (await state(page)).designs[0].id);
  await expect(page.locator('#modal')).toBeVisible();
  await expect(page.locator('#confirm-production-btn')).toBeVisible();
  await page.screenshot({ path: 'test-results/aurea-production-mobile.png', fullPage: true });
  await page.locator('.modal-close').click();

  await page.evaluate(() => window.showView('management', 'settings'));
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-backup-btn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^aurea-respaldo-.*\.json$/);
});
