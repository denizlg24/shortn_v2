# Gestionar códigos QR

Esta guía describe las opciones de diseño de un código QR, la exportación de archivos para imprimir, la exportación de varios códigos en un archivo ZIP y la eliminación de códigos.

## Encuentra tus códigos

Abre **Códigos QR** en la barra lateral. Usa **Buscar** para buscar por título, destino o código, filtra por **Etiqueta** y por **Creado**, y cambia la **Vista** entre **Cuadrícula** y **Lista**. Selecciona un código para abrir su resumen, donde están las pestañas **Resumen**, **Diseño**, **Escaneos** y **Detalles**.

## Opciones de diseño

Abre la pestaña **Diseño**. La vista previa se actualiza con cada cambio y te avisa cuando incluye cambios sin guardar. Selecciona **Guardar diseño** para aplicarlos.

- **Colores**: elige un predefinido o define los colores del **Código** y del **Fondo**. En **Esquinas**, mantén el color del código o elige otro para las esquinas.
- **Patrón**: elige la forma de los **Puntos**, de los **Cuadrados de las esquinas** y de los **Puntos de las esquinas**. Las formas solo cambian el aspecto; el enlace sigue siendo el mismo.
- **Corrección de errores**: elige un **Nivel**. Los niveles más altos permiten que el código aguante roces y un logotipo, a cambio de un patrón más denso.
- **Logotipo**: sube una imagen para el centro del código, ajusta el **Tamaño del logotipo** y, si quieres, activa **Ocultar el patrón detrás del logotipo**. Mantén el logotipo en el 50 % de la corrección de errores o menos. Los logotipos dependen de tu plan.
- **Forma y leyenda**: elige una **Forma** cuadrada o circular, un **Marco** (ninguno, contorno o sólido) y una **Leyenda** opcional de hasta 64 caracteres. Marcos y leyendas aparecen en las descargas.

El panel **Comprobación de escaneo** valora el contraste entre el código y el fondo y avisa de colores invertidos, fondo transparente y tamaño del logotipo.

## Exporta para imprimir

1. En el resumen del código, en **Descargar**, selecciona **Exportar para impresión**.
2. Elige el **Formato** (SVG, PNG o PDF) y el **Tamaño**.
3. Lee las indicaciones de impresión de la página: cuatro módulos de margen alrededor del código, corrección Q (H con logotipo), contraste mínimo de 3:1 y el tamaño mínimo recomendado a 300 dpi.
4. Selecciona **Preparar descarga** y después **Descargar archivo**.

Las descargas caducan 24 horas después de iniciar la exportación. Para pantallas, **JPEG para pantallas** en el resumen te da un JPEG al momento.

## Exporta varios códigos en un ZIP

1. En la lista de códigos QR, marca los que quieras o usa **Seleccionar esta página**. La selección se mantiene al cambiar de página y de filtros.
2. Selecciona **Exportar selección**.
3. Revisa la selección. Los filtros de esta página solo cambian la lista que ves; el ZIP incluye todos los códigos seleccionados.
4. Elige el **Formato** y el **Tamaño** y selecciona **Crear ZIP**.
5. Cuando la exportación esté lista, selecciona **Descargar ZIP**.

La página de exportación indica cuántos códigos caben en un ZIP. La exportación continúa aunque salgas de la página.

## Edita los detalles y el destino

La pestaña **Detalles** reúne la **URL de destino**, el **Título** y las **Etiquetas**. Cambiar el destino no altera el patrón impreso; las copias impresas siguen el nuevo destino desde el siguiente escaneo. Selecciona **Guardar detalles** para aplicarlo.

## Escaneos

El resumen muestra los últimos 30 días: escaneos, visitantes, escaneos totales y la fecha del último escaneo. La pestaña **Escaneos** abre las estadísticas completas del código. Los escaneos también aparecen en la página **Estadísticas** del espacio de trabajo, separados de los clics en enlaces. Consulta [Entender las estadísticas](/docs/es/guides/analytics/understanding-analytics).

## Elimina códigos QR

Selecciona **Eliminar código QR** en el resumen, o selecciona códigos en la lista y elige **Eliminar seleccionados**. La página de confirmación explica qué ocurre:

- el código deja de funcionar al instante, porque su enlace corto se elimina con él;
- los enlaces a los que estaba vinculado el código siguen funcionando y solo pierden su código QR;
- el historial de escaneos se archiva y deja de mostrarse.

Eliminar un código QR no se puede deshacer y las copias impresas no se pueden recuperar. Los miembros solo pueden eliminar los códigos que han creado.

## Siguientes pasos

- [Crear códigos QR](/docs/es/guides/qr-codes/creating-qr-codes)
- [Crear páginas bio](/docs/es/guides/bio-pages/creating-bio-pages)
