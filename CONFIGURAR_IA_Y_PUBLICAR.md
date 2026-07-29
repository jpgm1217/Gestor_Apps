# Aurea: PWA, ChatGPT manual y Firebase sin Blaze

## 1. Probar correctamente en el computador

No abras la carpeta `aurea/` desde `file:///`. Chrome muestra el índice de archivos y las funciones PWA/Firebase no trabajan correctamente.

En la raíz del repositorio ejecuta:

```bash
npx serve .
```

Luego abre la dirección local que muestre la terminal. También puedes usar la
extensión **Live Server** de VS Code.

## 2. Herramientas para publicar

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

## 4. Crear imágenes con la suscripción de ChatGPT

El modo actual no necesita una clave API, Cloud Functions, Storage ni el plan
Blaze. Usa la suscripción de ChatGPT de la persona autorizada:

1. Aurea prepara el prompt según el diseño, sus materiales y la marca.
2. La persona copia el prompt y abre ChatGPT.
3. Adjunta allí la foto real y las referencias visuales.
4. Descarga la escena creada e importa el resultado en Aurea.
5. Aurea agrega el logo, textos, beneficios y WhatsApp de forma exacta.
6. Para mejorarla, copia la corrección desde Aurea, pégala en la misma
   conversación de ChatGPT e importa la nueva versión.

## 5. Publicar

Hosting, Authentication y Realtime Database pueden usarse con el plan Spark
dentro de sus cuotas gratuitas:

```bash
firebase deploy --only hosting
```

La PWA usa la clave pública `aurea-web` de reCAPTCHA Enterprise para App Check.
Las reglas de Realtime Database deben publicarse después del frontend con Google
Authentication:

```bash
firebase deploy --only database
```

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
6. Pulsa **Preparar en ChatGPT**, copia el prompt y adjunta las fotos en ChatGPT.
7. Descarga la escena e impórtala con **Importar resultado**.
8. Escribe correcciones en **Seguir mejorando en ChatGPT**, cópialas y pégalas
   en la misma conversación. Importa cada resultado como una nueva versión.
9. Pulsa **Descargar publicidad**. La fotografía viene de ChatGPT, pero el
   logo, el titular, los beneficios y WhatsApp los compone Aurea para que el
   texto quede exacto.
10. Guarda el diseño para conservar las instrucciones y versiones.

## 7. Automatización opcional para el futuro

El repositorio conserva una función preparada para automatizar la generación en
otra fase. Esa opción sí requiere plan Blaze, Storage, una clave de la API de
OpenAI con facturación separada y estos secretos:

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set AUREA_ALLOWED_EMAILS
firebase deploy --only functions:generateAureaDesignImage
```

No escribas claves en GitHub, HTML ni JavaScript. No publiques reglas abiertas
de Realtime Database para información privada.
