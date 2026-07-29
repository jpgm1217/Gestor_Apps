# Subir Aurea V3 al repositorio

## Opción recomendada: reemplazar los archivos desde VS Code

1. Haz una copia de seguridad del proyecto actual.
2. Descomprime este ZIP.
3. Copia el contenido descomprimido dentro de la carpeta local del repositorio.
4. Cuando el sistema pregunte, acepta reemplazar los archivos existentes.
5. Abre la carpeta del repositorio en VS Code.
6. En la terminal ejecuta:

```bash
git status
```

7. Revisa que aparezcan principalmente estos cambios:

```text
index.html
aurea/index.html
aurea/css/styles.css
aurea/js/app.js
aurea/manifest.json
aurea/sw.js
AUREA_NOTAS.md
PASO_A_PASO_SUBIR_REPO.md
```

8. Crea una rama:

```bash
git checkout -b feature/aurea-v3
```

9. Agrega los cambios:

```bash
git add .
```

10. Crea el commit:

```bash
git commit -m "feat: agregar Aurea V3 como PWA independiente"
```

11. Sube la rama:

```bash
git push -u origin feature/aurea-v3
```

12. En GitHub crea el Pull Request y revisa los archivos antes de combinarlo con la rama principal.

## Prueba local

No abras `index.html` directamente con doble clic. Usa Live Server de VS Code o ejecuta:

```bash
npx serve .
```

Prueba estas rutas:

```text
/              GomezHub
/aurea/        PWA independiente de Aurea
```

## Después de publicar

- Si Aurea conserva una versión anterior, cierra la PWA y vuelve a abrirla.
- En casos de caché persistente, desinstala Aurea y vuelve a instalarla.
- Crea el PIN la primera vez.
- Verifica inventario, una compra, un diseño, una venta y un gasto antes de usar datos reales.
