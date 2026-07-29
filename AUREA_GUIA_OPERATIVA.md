# Guía operativa de Aurea

## Flujo recomendado

1. **Registrar materiales**
   - Define un código único.
   - Elige una unidad base: unidad, centímetro, metro o gramo.
   - El costo y el stock siempre se expresan en esa unidad.

2. **Registrar compras**
   - La cantidad corresponde a las unidades base que realmente ingresan.
   - Ejemplo: cinco bolsas de veinte balines se registran como `100 unidades`.
   - Aurea recalcula el costo promedio del material.

3. **Crear el producto**
   - En **Diseñar**, asigna nombre, SKU y stock mínimo terminado.
   - Agrega todos los materiales consumidos por una sola manilla.
   - Guardar o editar la receta no descuenta inventario.

4. **Fabricar**
   - En **Gestión → Producción**, elige el producto y la cantidad.
   - Aurea valida todos los materiales antes de hacer cambios.
   - Al confirmar, descuenta insumos, congela el costo y aumenta las manillas terminadas.

5. **Vender**
   - **Desde stock terminado:** descuenta manillas ya fabricadas.
   - **Fabricar y vender bajo pedido:** registra una producción y una venta separadas; el stock terminado queda igual.
   - El costo se asigna por lotes, empezando por el más antiguo.

6. **Cobrar**
   - Registra el pago inicial o deja el valor en cero.
   - Los nuevos abonos se agregan en **Gestión → Cartera**.
   - El estado Pendiente, Abono o Pagado se calcula automáticamente.
   - Si un abono se digitó por error, abre la venta y usa **Anular** junto al pago. El pago no se borra: queda tachado con el motivo para conservar la trazabilidad.

## Reversiones

- Anular una venta nueva devuelve producto terminado; nunca devuelve directamente los balines.
- Si había dinero recibido, Aurea registra el reembolso.
- Un lote solo puede anularse si todas sus unidades continúan disponibles.
- Al anular una fabricación recuperable, vuelven los materiales de su receta congelada.
- Las ventas creadas antes de esta versión conservan su forma histórica de reversión.

## Inventario inicial

- Los materiales que ya existen se registran como stock inicial al crear o ajustar el material.
- Las manillas fabricadas antes de usar el módulo se cargan con **Inventario inicial** dentro de Producción.
- El inventario inicial de manillas no vuelve a descontar materias primas.

## Seguridad operativa

- Compras, ajustes de stock, fabricación, ventas, pagos y anulaciones necesitan conexión.
- Estas operaciones se confirman mediante transacciones para evitar stock negativo entre celular y computador.
- Si otro dispositivo guardó primero un cambio no operativo, Aurea recarga la información y solicita repetir el último cambio.
- Descarga periódicamente un respaldo desde **Gestión → Ajustes → Copia de seguridad**.

## Despliegue y recuperación

Antes de publicar un cambio de esquema, exporta el nodo de Aurea:

```powershell
firebase database:get /aurea/v1/data --project gomez-hub --output "aurea-antes-del-cambio.json"
```

Publica primero el código de Hosting. Cuando ambos accesos de Aurea ya sirvan la misma versión, despliega las reglas:

```powershell
firebase deploy --only hosting --project gomez-hub
firebase deploy --only database --project gomez-hub
```

El primer ingreso autorizado migra los datos dentro de una transacción. Si la verificación falla, no sigas registrando operaciones y restaura el respaldo:

```powershell
firebase database:set /aurea/v1/data "aurea-antes-del-cambio.json" --project gomez-hub --confirm
```

La restauración reemplaza todo el nodo de Aurea; úsala únicamente con el archivo verificado y con la aplicación cerrada en los demás dispositivos.
