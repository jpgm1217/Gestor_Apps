# Aurea integrada e independiente

## Cómo queda la arquitectura

Una sola fuente (`aurea/`) produce dos accesos:

1. **Integrado en Gomez Hub**
   - Tarjeta **Aurea** en `index.html`.
   - URL: <https://gomez-hub.web.app/aurea/>.
2. **Aplicación independiente**
   - Repositorio público: `jpgm1217/aurea`.
   - URL de GitHub Pages: <https://jpgm1217.github.io/aurea/>.

Las dos versiones usan el mismo proyecto Firebase `gomez-hub` y, por tanto, la
misma información. Este es el mismo patrón general del repositorio
`jpgm1217/cobrador`: una entrada dentro de Gestor Apps y otra URL independiente.

## 1. Crear el repositorio independiente

En GitHub:

1. Pulsa **New repository**.
2. Nombre: `aurea`.
3. Visibilidad: **Public**.
4. No agregues README, `.gitignore` ni licencia.
5. Pulsa **Create repository**.

En PowerShell, desde la raíz de Gestor Apps:

```powershell
.\scripts\preparar-aurea-independiente.ps1 -Destino ..\Aurea-independiente
cd ..\Aurea-independiente
git init -b main
git add .
git commit -m "feat: publicar Aurea como PWA independiente"
git remote add origin https://github.com/jpgm1217/aurea.git
git push -u origin main
```

## 2. Activar GitHub Pages

Dentro del repositorio `jpgm1217/aurea`:

1. Abre **Settings**.
2. En la barra izquierda abre **Pages**.
3. En **Build and deployment**, elige **Deploy from a branch**.
4. Selecciona la rama **main** y la carpeta **/(root)**.
5. Pulsa **Save**.
6. Espera uno o dos minutos y abre
   <https://jpgm1217.github.io/aurea/>.

## 3. Firebase Hosting para Gomez Hub

Desde la raíz de Gestor Apps:

```powershell
firebase login
firebase use gomez-hub
firebase deploy --only hosting
```

Comprueba:

- <https://gomez-hub.web.app/>
- <https://gomez-hub.web.app/aurea/>

## 4. Authentication y reglas

El PIN de Aurea solo bloquea la pantalla. No protege por sí mismo los datos en
Realtime Database. Antes de usar información real:

1. Firebase Console → proyecto **gomez-hub**.
2. **Build → Authentication → Get started**.
3. Activa el proveedor **Google**.
4. En **Settings → Authorized domains**, agrega `jpgm1217.github.io`.
5. Agrega el segundo correo permitido a `database.rules.json`.
6. Publica las reglas únicamente después de publicar el frontend con acceso
   Google: `firebase deploy --only database`.

No despliegues reglas nuevas hasta definir las cuentas que deben entrar; una
regla incorrecta puede bloquear la aplicación o dejar los datos expuestos.

## 5. Generación de imágenes con IA

Esta parte requiere servicios facturables:

1. Cambia el proyecto al plan **Blaze** y configura alertas de presupuesto.
2. Crea o habilita Firebase Storage.
3. Configura Google Authentication con los correos autorizados, agrega
   `jpgm1217.github.io` a los dominios autorizados y activa App Check.
4. En PowerShell ejecuta:

```powershell
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set AUREA_ALLOWED_EMAILS
firebase deploy --only functions:generateAureaDesignImage
firebase functions:list
```

No escribas la clave de OpenAI en GitHub, HTML ni JavaScript.
Cuando la terminal pida `AUREA_ALLOWED_EMAILS`, escribe los dos correos de Google
separados por coma. No despliegues la función hasta activar y exigir App Check.

El estudio creativo permite guardar hasta cuatro referencias de estilo, subir
la foto real del producto y conversar sobre la imagen generada. Las correcciones
usan el contexto de la versión anterior. El logo, los textos comerciales y el
WhatsApp se agregan mediante la plantilla de Aurea para evitar errores de
ortografía o números deformados en la imagen generada.

## 6. Instalar en el celular

### Android

1. Abre una de las URL de Aurea en Chrome.
2. Pulsa el aviso **Instalar Aurea**.
3. Si no aparece: menú de Chrome → **Instalar aplicación**.

### iPhone o iPad

1. Abre Aurea en Safari.
2. Pulsa **Compartir**.
3. Selecciona **Agregar a pantalla de inicio**.

La instalación actual es PWA, igual que una app abierta desde un ícono. No se
genera todavía un archivo APK, AAB o IPA.
