# Aurea V3: prueba local, OpenAI y Firebase

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

## 3. Activar acceso anónimo

Firebase Console → Authentication → Sign-in method → Anonymous → Enable.

La persona no verá un inicio de sesión. La PWA abre el PIN de cuatro números y Firebase crea una sesión técnica anónima en segundo plano.

## 4. Configurar la clave de OpenAI

La clave nunca debe escribirse en `aurea/js/app.js`, GitHub ni el navegador.

Desde la raíz ejecuta:

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

Pega la clave cuando la terminal la solicite. Debe ser una clave de la plataforma API de OpenAI, no la suscripción de ChatGPT Plus.

## 5. Publicar

El Hosting puede publicarse en el plan actual:

```bash
firebase deploy --only hosting
```

Para publicar la función de IA primero debes activar el plan Blaze y Firebase
Authentication anónima. Después configura el secreto y despliega la función:

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions:generateAureaDesignImage
```

Después prueba:

```text
https://gomez-hub.web.app/aurea/
```

## 6. Crear imágenes

1. En Aurea entra a **Diseñar**.
2. Agrega los materiales y cantidades.
3. Selecciona modelo, calidad y formato en **Gestión → Configuración**.
4. Pulsa **Generar con IA**.
5. La imagen queda guardada en Firebase Storage y asociada al diseño cuando lo guardes.

## Observaciones

- Firebase Cloud Functions requiere el plan Blaze para desplegar funciones.
- OpenAI API se cobra por separado de ChatGPT.
- Se configuró un límite inicial de 20 imágenes diarias por dispositivo/sesión anónima.
- No publiques reglas abiertas de Realtime Database para información privada.
