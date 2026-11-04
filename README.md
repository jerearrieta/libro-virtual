# Mi bitácora 2026

Cuaderno virtual de **Semiótica Aplicada** (Com 1 · Prof. Consuelo MOISSET · Alumna: Centeno Velázquez, Lourdes Abril).

Sitio estático hecho con HTML, CSS y JavaScript, sin pasos de compilación.

## Cómo funciona

- Arranca con la tapa (página 1 del PDF) y el título fijo **Mi bitácora 2026** arriba a la izquierda. El fondo, el título y la contratapa siguen la estética de la tapa (papel crema, violeta, Abril Fatface y DM Mono).
- Al tocar la tapa, el cuaderno se abre y los datos de la tapa viajan animados hasta el título.
- Las hojas se pasan con efecto de papel real: con las flechas de las esquinas inferiores, arrastrando la esquina de la hoja, deslizando en el celular o con las flechas del teclado.
- Al terminar, el cuaderno se cierra y muestra la contratapa (lisa); a los pocos segundos, o al tocarla, vuelve a la tapa.
- Recién cuando se termina de leer el cuaderno aparece el botón **Índice** para ir directo a cualquier hoja. Al recargar la página vuelve a estar oculto.
- **Ampliar** (o doble clic sobre una hoja) abre la hoja en grande para leerla cómodo.
- En celulares se muestra una hoja por vez.

## Estructura

```
index.html               página
css/styles.css           estilos
js/app.js                lógica del cuaderno
assets/paginas/          una imagen por página del PDF (pagina-01.webp es la tapa, 02 … 19 son las hojas)
assets/miniaturas/       miniaturas para el índice
assets/vendor/           StPageFlip 2.0.7 (licencia MIT), la librería del paso de hojas
```

## Cambiar las hojas

1. Exportar cada página del PDF como imagen (1600 px de ancho, formato A4 vertical) con el nombre `pagina-XX.webp` en `assets/paginas/` y una copia chica en `assets/miniaturas/`.
2. `pagina-01.webp` se usa como tapa. Si cambia la cantidad de hojas, actualizar `TOTAL_SHEETS` (hojas sin contar la tapa) al principio de `js/app.js`.

## Probar en la compu

Abrir una terminal en la carpeta y correr `python3 -m http.server`, después entrar a http://localhost:8000.

## Publicar en Vercel

1. Entrar a https://vercel.com e iniciar sesión con GitHub.
2. **Add New… → Project**, elegir el repositorio `libro-virtual` y tocar **Import**.
3. Framework Preset: **Other**. No hace falta comando de build ni carpeta de salida.
4. **Deploy**. Vercel da un link del tipo `libro-virtual.vercel.app`, y cada cambio que se suba a `main` se publica solo.
