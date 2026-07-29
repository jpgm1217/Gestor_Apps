# Gestor Apps

Portal personal de aplicaciones web con el módulo independiente **Aurea** para
inventario, diseños, compras, ventas, clientes y gastos.

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

## Firebase

El proyecto configurado es `gomez-hub`.

```bash
firebase use gomez-hub
firebase deploy --only hosting
```

La generación de imágenes usa una Cloud Function y requiere el plan Blaze,
Firebase Authentication y el secreto `OPENAI_API_KEY`. Consulta
`CONFIGURAR_IA_Y_PUBLICAR.md` antes de activarla.

## Seguridad

El PIN de cuatro dígitos de Aurea evita acceso casual en la interfaz, pero no
reemplaza Firebase Authentication ni reglas privadas de Realtime Database.
Antes de almacenar información sensible se deben cerrar las reglas y autorizar
solamente las cuentas que usarán la aplicación.
