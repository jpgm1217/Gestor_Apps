# Gestor Apps

Portal personal de aplicaciones web con el módulo independiente **Aurea** para
materiales, diseños, producción por lotes, inventario terminado, ventas,
abonos, clientes y gastos.

## Enlaces

- Portal web: <https://gomez-hub.web.app/>
- Aurea dentro del portal: <https://gomez-hub.web.app/aurea/>
- Aurea independiente: `https://jpgm1217.github.io/aurea/` (se habilita
  después de crear el repositorio `jpgm1217/aurea` y activar GitHub Pages).

## Instalar Aurea en el celular

### Android

1. Abre <https://gomez-hub.web.app/aurea/> en Chrome.
2. Pulsa **Instalar** cuando aparezca el aviso.
3. Si el aviso no aparece, abre el menú de Chrome y elige
   **Instalar aplicación** o **Agregar a pantalla principal**.

### iPhone o iPad

1. Abre la URL de Aurea en Safari.
2. Pulsa **Compartir**.
3. Selecciona **Agregar a pantalla de inicio**.

Aurea es una PWA: se instala desde el navegador y se abre como una aplicación.
Este repositorio todavía no genera un archivo APK, AAB o IPA nativo.

## Operación de Aurea

El flujo estable es:

```text
comprar materiales → guardar receta → fabricar → vender → cobrar
```

También existe **Fabricar y vender bajo pedido**. Consulta
[AUREA_GUIA_OPERATIVA.md](AUREA_GUIA_OPERATIVA.md) para inventario inicial,
unidades de medida, costos por lote, abonos y anulaciones.

## Publicación independiente

La carpeta `aurea/` es también la fuente de la aplicación independiente. Para
preparar un repositorio separado, ejecuta desde PowerShell:

```powershell
.\scripts\preparar-aurea-independiente.ps1 `
  -Destino ..\Aurea-independiente
```

Después sube el contenido generado al repositorio público `jpgm1217/aurea` y
activa **Settings → Pages → Deploy from a branch → main / root**.

## Desarrollo local

No abras los HTML con `file:///`. Desde la raíz ejecuta:

```bash
npx serve .
```

Después abre la dirección local que muestre la terminal.

## Estructura del repositorio

- `apps/`: aplicaciones integradas del portal.
- `aurea/`: fuente de la PWA de Aurea.
- `tests/`: pruebas automáticas de inventario, producción, ventas, cartera e imágenes.
- `scripts/`: sincronización de Aurea con su repositorio independiente.
- `.github/workflows/`: validación automática antes de publicar.

Los paquetes instalados, cachés de Firebase, logs, respaldos privados y
resultados de Playwright son archivos locales generados. Están excluidos
mediante `.gitignore` y no se suben a GitHub.

## Firebase

El proyecto configurado es `gomez-hub`.

```bash
firebase use gomez-hub
firebase deploy --only hosting
```

El estudio creativo funciona con el ChatGPT del usuario: Aurea prepara el
prompt, abre ChatGPT y permite importar y corregir versiones. Este flujo manual
no necesita el plan Blaze ni una clave de OpenAI. Google Authentication, App
Check y las reglas privadas de Realtime Database sí protegen los datos.

## Seguridad

El PIN de cuatro dígitos de Aurea evita acceso casual en la interfaz, pero no
reemplaza Firebase Authentication ni reglas privadas de Realtime Database.
El repositorio incluye reglas privadas para la cuenta propietaria y validación
del esquema operativo. Antes de agregar otra persona, incluye su correo
verificado en las reglas y vuelve a desplegarlas.
La ruta heredada `deudas_jv_v1` conserva por compatibilidad sus permisos
anteriores y debe migrarse después a autenticación real.
