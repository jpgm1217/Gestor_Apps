const { test, expect } = require('@playwright/test');
const { prestamosFirebaseStub } = require('./helpers/prestamos-firebase-stub');

const ADMIN_PIN_HASH = 'ce3a33104907e2ce90e3924b8a7be7eb8eb92ea1981229939e4ae0af1f2caa88';
const ADMIN_URL = 'http://127.0.0.1:4173/apps/App_AdminPrestamos.html';
const COBRADOR_URL = 'http://127.0.0.1:4173/apps/App_Cobrar.html';

function makeLoan(overrides = {}) {
  return {
    id: 'c-test',
    nombre: 'Cliente Prueba',
    cedula: '1000000000',
    telefono: '',
    zona: 'Pruebas',
    negocio: 'Negocio de prueba',
    notas: '',
    banco: '',
    tipoCuenta: '',
    numeroCuenta: '',
    capital: 200000,
    tasa: 20,
    interes: 40000,
    total: 240000,
    cuota: 120000,
    cuotaUltima: 120000,
    numCuotas: 2,
    plazo: 2,
    pagadas: 0,
    tipo: 'quincenal',
    tipoLabel: 'quincena',
    fechaInicio: '2026-08-15',
    diasCuota: 15,
    moraDia: 0,
    moraPerdonada: 0,
    moraCobradaTotal: 0,
    abonoPendiente: 0,
    abonoParcial: 0,
    esInterno: false,
    comisionPct: null,
    creado: '2026-07-01T12:00:00-05:00',
    cuotasData: [
      { num: 1, fecha: '31/08/2026', fechaISO: '2026-08-31', cuota: 120000, capital: 100000, interes: 20000, saldo: 120000 },
      { num: 2, fecha: '15/09/2026', fechaISO: '2026-09-15', cuota: 120000, capital: 100000, interes: 20000, saldo: 0 }
    ],
    comisionEventos: [],
    historialMora: [],
    historialNoPago: [],
    historialAjustes: [],
    cargosManuales: [],
    ciclos: [],
    historialPrestamos: [],
    ...overrides
  };
}

function makeSeed(client, overrides = {}) {
  return {
    clientes: client ? { [client.id]: client } : {},
    actividad: {},
    caja: {},
    liquidaciones: {},
    solicitudes: {},
    pool: { saldo: 0, totalEntradas: 0, totalSalidas: 0, movimientos: [] },
    config: {
      pinAdminHash: ADMIN_PIN_HASH,
      comisionPct: 40,
      creditoCobrador: 0,
      disponibleManual: null,
      params: { tasa: 20, tipo: 'quincenal', plazo: 2, moraDia: 0 }
    },
    ...overrides
  };
}

async function installFirebaseStub(page, seed, { cobrador = false } = {}) {
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: '/* Firebase reemplazado por stub aislado para pruebas. */'
  }));
  await page.addInitScript(initialData => {
    window.__PRESTAMOS_FIREBASE_SEED__ = initialData;
  }, seed);
  await page.addInitScript(prestamosFirebaseStub);
  if (cobrador) {
    await page.addInitScript(() => localStorage.setItem('cr_pin_cobrador', '1234'));
  }
}

async function enterPin(page) {
  await expect.poll(() => page.evaluate(() => typeof pinKey)).toBe('function');
  await page.evaluate(() => ['1', '2', '3', '4'].forEach(digit => pinKey(digit)));
  await expect(page.locator('#pin-screen')).toHaveClass(/hidden/, { timeout: 5000 });
  await expect(page.locator('#conn-status')).toHaveText('En línea');
}

async function openAdmin(page, seed) {
  await installFirebaseStub(page, seed);
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
  await enterPin(page);
  await expect.poll(() => page.evaluate(() => clientes.length)).toBe(Object.keys(seed.clientes || {}).length);
  await page.waitForTimeout(30);
}

async function openCobrador(page, seed) {
  await installFirebaseStub(page, seed, { cobrador: true });
  await page.goto(COBRADOR_URL, { waitUntil: 'load' });
  await enterPin(page);
  await expect.poll(() => page.evaluate(() => clientes.length)).toBe(Object.keys(seed.clientes || {}).length);
  await page.waitForTimeout(30);
}

test.describe('Préstamos — flujos críticos aislados de producción', () => {
  test('Admin permite unificar dos cuotas en una sola con vencimiento el 15', async ({ page }) => {
    const seed = makeSeed(makeLoan());
    await openAdmin(page, seed);

    await page.evaluate(() => abrirEditarCliente('c-test'));
    await page.locator('#edit-plazo').fill('1');
    await page.locator('#edit-fecha-inicio').fill('2026-08-31');
    await page.evaluate(() => guardarEdicionCliente());

    await expect.poll(() => page.evaluate(() => {
      const client = window.__prestamosFirebaseTest.getValue('clientes/c-test');
      return {
        numCuotas: client.numCuotas,
        plazo: client.plazo,
        cuota: client.cuota,
        total: client.total,
        fechaISO: client.cuotasData[0]?.fechaISO
      };
    })).toEqual({
      numCuotas: 1,
      plazo: 1,
      cuota: 240000,
      total: 240000,
      fechaISO: '2026-09-15'
    });

    const activity = await page.evaluate(() => Object.values(
      window.__prestamosFirebaseTest.getValue('actividad') || {}
    ));
    expect(activity.some(item => item.tipo === 'edicion' && item.nota.includes('plazo→1 cuotas'))).toBeTruthy();
  });

  test('Admin registra un pago total cuota por cuota sin duplicar caja ni comisión', async ({ page }) => {
    const seed = makeSeed(makeLoan());
    await openAdmin(page, seed);

    let dialogs = 0;
    page.on('dialog', async dialog => {
      dialogs += 1;
      if (dialogs === 1) await dialog.accept();
      else await dialog.dismiss();
    });

    await page.evaluate(() => pagoTotalRestante('c-test'));

    await expect.poll(() => page.evaluate(() =>
      window.__prestamosFirebaseTest.getValue('clientes/c-test/pagadas')
    )).toBe(2);

    const state = await page.evaluate(() => window.__prestamosFirebaseTest.getData());
    const client = state.clientes['c-test'];
    const caja = Object.values(state.caja || {});
    const activity = Object.values(state.actividad || {}).filter(item => item.tipo === 'pago');

    expect(client.comisionEventos).toHaveLength(2);
    expect(client.comisionEventos.reduce((sum, event) => sum + event.interes, 0)).toBe(40000);
    expect(client.comisionEventos.reduce((sum, event) => sum + event.comision, 0)).toBe(16000);
    expect(caja).toHaveLength(4);
    expect(caja.filter(item => item.subtipo === 'recuperacion_capital').reduce((sum, item) => sum + item.monto, 0)).toBe(200000);
    expect(caja.filter(item => item.subtipo === 'interes_cobrado').reduce((sum, item) => sum + item.monto, 0)).toBe(40000);
    expect(new Set(caja.map(item => item.refKey)).size).toBe(4);
    expect(activity).toHaveLength(2);
    expect(state.pool.saldo).toBe(240000);
  });

  test('El auto-cuadre repone interés perdido sin inventar capital ya registrado', async ({ page }) => {
    const client = makeLoan({
      pagadas: 1,
      comisionEventos: [{
        id: 'ce-c-test-1',
        ts: 1788372000000,
        origen: 'cobro',
        interes: 20000,
        mora: 0,
        pct: 40,
        comision: 8000,
        admin: 12000,
        liquidado: false,
        autor: 'Cobrador'
      }]
    });
    const seed = makeSeed(client, {
      caja: {
        'capital-existente': {
          id: 'capital-existente',
          tipo: 'ingreso',
          subtipo: 'recuperacion_capital',
          monto: 100000,
          clienteId: 'c-test',
          refKey: 'pago_cob:c-test:c1:1:cap',
          auto: true,
          ts: 1788372000000
        }
      }
    });
    await openAdmin(page, seed);

    const result = await page.evaluate(() => detectarCuadreCaja().map(item => ({
      clienteId: item.c.id,
      addCap: item.addCap,
      addInt: item.addInt,
      addMora: item.addMora
    })));

    expect(result).toEqual([{ clienteId: 'c-test', addCap: 0, addInt: 20000, addMora: 0 }]);
  });

  test('Admin repara numCuotas cuando el cronograma contiene más cuotas reales', async ({ page }) => {
    const client = makeLoan({ numCuotas: 1, plazo: 1 });
    const seed = makeSeed(client);
    await openAdmin(page, seed);

    await expect.poll(() => page.evaluate(() => {
      const remote = window.__prestamosFirebaseTest.getValue('clientes/c-test');
      return { numCuotas: remote.numCuotas, plazo: remote.plazo };
    })).toEqual({ numCuotas: 2, plazo: 2 });

    const activity = await page.evaluate(() => Object.values(
      window.__prestamosFirebaseTest.getValue('actividad') || {}
    ));
    expect(activity.some(item => item.tipo === 'reparacion_numcuotas')).toBeTruthy();
  });

  test('Cobrador bloquea el doble toque y registra una sola cuota completa', async ({ page }) => {
    const seed = makeSeed(makeLoan());
    await openCobrador(page, seed);

    await page.evaluate(() => abrirConfirm('c-test'));
    await page.locator('#confirm-mora').fill('0');
    await page.evaluate(async () => {
      await Promise.all([confirmarPago(), confirmarPago()]);
    });

    await expect.poll(() => page.evaluate(() =>
      window.__prestamosFirebaseTest.getValue('clientes/c-test/pagadas')
    )).toBe(1);

    const state = await page.evaluate(() => window.__prestamosFirebaseTest.getData());
    const client = state.clientes['c-test'];
    const caja = Object.values(state.caja || {});
    const activity = Object.values(state.actividad || {}).filter(item => item.tipo === 'pago');

    expect(client.comisionEventos).toHaveLength(1);
    expect(client.comisionEventos[0].comision).toBe(8000);
    expect(caja).toHaveLength(2);
    expect(caja.reduce((sum, item) => sum + item.monto, 0)).toBe(120000);
    expect(new Set(caja.map(item => item.refKey)).size).toBe(2);
    expect(activity).toHaveLength(1);
    expect(activity[0].cuota).toBe(1);
  });
});
