# Módulo Aurea V2

## Accesos

- Desde GomezHub: `index.html` → sección **Negocio** → **Aurea**.
- PWA independiente: ruta `/aurea/`.
- La PWA de Aurea tiene manifest, íconos y service worker propios.
- Ambas entradas usan la misma información de Firebase.

## Firebase Realtime Database

La aplicación reutiliza el proyecto Firebase `gomez-hub` y guarda la información bajo:

- `aurea/v1/data`
- `aurea/v1/config/pinHash`

Se conserva la ruta V1 para no perder información creada con la versión anterior.

## Parámetros iniciales

- Empaque y presentación: $5.000
- Mano de obra: $15.000
- Desperdicio: 5%
- Margen mínimo: 35%
- Margen recomendado: 45%
- Margen premium: 55%
- Redondeo: $1.000

Todos se pueden modificar desde **Gestión → Ajustes**.

## Funciones incluidas

- PIN de cuatro dígitos compartido entre dispositivos.
- Catálogo inicial con los precios de compra de 12 a 99 unidades.
- CRUD de materiales: crear, consultar, editar, activar, desactivar y eliminar cuando no tenga movimientos.
- Compras con costo promedio ponderado, edición de datos y anulación con reversión de inventario.
- Constructor de manillas con desglose completo de materiales y costos internos.
- Precio mínimo, recomendado y premium.
- CRUD de diseños: crear, consultar, actualizar, duplicar y eliminar/desactivar.
- Subida y compresión de fotografías para cada diseño.
- Boceto automático según cantidad y tamaño de accesorios.
- Generador de prompt para crear imágenes en una herramienta de IA externa y luego subirlas.
- Ventas con edición, anulación, reversión de inventario y utilidad.
- CRUD de clientes.
- CRUD de gastos.
- Movimientos de inventario.
- Dashboard con ventas, utilidad bruta, gastos, utilidad neta e inventario.
- Cotización por WhatsApp.

## Imágenes

Las fotografías se comprimen en el navegador y se guardan dentro de los datos del diseño. Es adecuado para el MVP, pero no para almacenar muchas fotografías de alta resolución. En una siguiente versión se recomienda migrarlas a Firebase Storage.

## Seguridad

El PIN evita el acceso casual, pero no reemplaza autenticación y reglas cerradas. Antes de una publicación pública amplia se recomienda agregar Firebase Authentication anónima, App Check y reglas por usuario/dispositivo.

## V3
- Corregido el acceso local a `aurea/index.html`.
- Acceso privado con Google Authentication, PIN compartido y App Check.
- Reglas de Realtime Database limitadas a los correos autorizados.
- Flujo sin Blaze que usa la suscripción de ChatGPT: copiar prompt, importar
  resultados, preparar correcciones y conservar hasta seis versiones.
- Plantilla determinista para logo, textos comerciales, beneficios y WhatsApp.
- Formato y tema de la publicidad configurables.
- La automatización mediante Firebase Functions, Storage y OpenAI API queda
  disponible como ampliación opcional con facturación.
