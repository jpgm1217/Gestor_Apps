# Aurea: PWA, estudio creativo con IA y Firebase

## 1. Probar correctamente en el computador

No abras la carpeta `aurea/` desde `file:///`. Chrome muestra el índice de archivos y las funciones PWA/Firebase no trabajan correctamente.

En la raíz del repositorio ejecuta:

```bash
npx serve .
```

Luego abre la dirección local que muestre la terminal. También puedes usar la
extensión **Live Server** de VS Code.

## 2. Instalar herramientas

Desde la raíz del proyecto:

```bash
npm install -g firebase-tools
firebase login
firebase use gomez-hub
cd functions
npm install
cd ..
```

## 3. Configurar acceso autorizado

Antes de desplegar la función, activa Firebase Authentication con Google y
autoriza únicamente los correos que administrarán Aurea. Agrega también
`jpgm1217.github.io` a los dominios autorizados.

El repositorio incluye `database.rules.json` con acceso inicial para
`gomajupa@gmail.com`. Agrega el segundo correo a las reglas antes de desplegarlas.
No uses solamente el PIN para proteger una API con facturación.

La ruta existente `deudas_jv_v1` se conserva temporalmente con sus permisos
anteriores para no romper la app de deudas. Es una deuda de seguridad separada:
esa app también debe migrarse a Google Authentication en una fase posterior.

## 4. Configurar la clave de OpenAI

La clave nunca debe escribirse en `aurea/js/app.js`, GitHub ni el navegador.

Desde la raíz ejecuta:

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set AUREA_ALLOWED_EMAILS
```

En el primer aviso pega la clave de la plataforma API de OpenAI, no la
suscripción de ChatGPT Plus. En el segundo escribe los correos permitidos
separados por coma, por ejemplo `gomajupa@gmail.com,segundo@gmail.com`.

## 5. Publicar

El Hosting puede publicarse en el plan actual:

```bash
firebase deploy --only hosting
```

Para publicar la función de IA primero debes activar el plan Blaze, Google
Authentication, Storage y App Check. Después configura el secreto y despliega
la función:

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set AUREA_ALLOWED_EMAILS
firebase deploy --only database
firebase deploy --only functions:generateAureaDesignImage
```

No despliegues todavía la función mientras App Check no tenga una clave web
registrada y `enforceAppCheck` no esté activado en la callable.

Después prueba:

```text
https://gomez-hub.web.app/aurea/
```

## 6. Crear y mejorar imágenes

1. En Aurea entra a **Diseñar**.
2. Agrega los materiales y cantidades.
3. Si existe, sube una foto real de la manilla para conservar el producto.
4. En **Gestión → Ajustes**, guarda el prompt de marca y hasta cuatro imágenes
   de referencia de estilo.
5. Selecciona calidad, formato y tema de la plantilla.
6. Pulsa **Crear con IA**.
7. Escribe correcciones en **Hablar con la IA**. Cada mensaje edita la imagen
   anterior y conserva las versiones para poder regresar.
8. Pulsa **Descargar publicidad**. La fotografía es generada por IA, pero el
   logo, el titular, los beneficios y WhatsApp los compone Aurea para que el
   texto quede exacto.
9. Guarda el diseño para conservar la conversación y las versiones.

## Observaciones

- Firebase Cloud Functions requiere el plan Blaze para desplegar funciones.
- OpenAI API se cobra por separado de ChatGPT.
- Se configuró un límite inicial de 20 generaciones o mejoras diarias por cuenta
  autorizada. Los intentos fallidos devuelven la reserva de cupo.
- El estudio creativo usa Responses API para mantener el contexto entre mejoras
  y GPT Image 2 para generar o editar la fotografía.
- No publiques reglas abiertas de Realtime Database para información privada.
- Responses API conserva el contexto necesario para continuar la edición. Define
  y comunica una política de retención para fotos, prompts e imágenes de Storage.
