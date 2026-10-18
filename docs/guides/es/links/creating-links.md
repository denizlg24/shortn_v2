# Crear enlaces

Un enlace corto lleva a los visitantes a una URL de destino y cuenta cada visita. Esta guía recorre el formulario de creación, del destino a las reglas avanzadas de redirección, y explica cómo importar enlaces en bloque.

## Crea un enlace

1. Abre **Enlaces** en la barra lateral y selecciona **Nuevo enlace**. También puedes pegar una URL en cualquier parte de la página de enlaces, fuera de un campo de texto, o pulsar C.
2. Escribe la **URL de destino**. Es el único campo obligatorio.
3. Rellena los campos opcionales que quieras; se describen más abajo.
4. Selecciona **Crear enlace**.

Shortn copia el enlace corto al portapapeles y abre su resumen. Cada enlace que creas cuenta para el límite mensual de enlaces de tu plan, que ves en **Uso** en la barra lateral.

## Sugerencias de título y clave

Al pegar un destino, Shortn consulta la página. Cuando llegan los datos, selecciona **Usar título de página** para rellenar el **Título**, o **Usar clave sugerida** para quedarte con una clave legible. Lo que hayas escrito tú nunca se sobrescribe. Si no se puede leer la página, escribe un título o déjalo vacío.

## Clave personalizada

La clave es la parte que va después del dominio, por ejemplo `ejemplo` en `shortn.at/ejemplo`. Deja **Clave personalizada** vacía para obtener una clave aleatoria, o escribe la tuya con letras, dígitos, `-` y `_`. Las claves personalizadas dependen de tu plan; si el tuyo no las incluye, el formulario te dice qué plan las incluye.

Si más adelante cambias la clave, la anterior sigue redirigiendo al mismo enlace.

## Título, descripción y etiquetas

El **Título** y la **Descripción** te ayudan a encontrar el enlace en las listas y en las estadísticas. Los visitantes no los ven.

En **Etiquetas**, busca una etiqueta existente o escribe una nueva para crearla. Cada enlace admite hasta 50 etiquetas. Las etiquetas alimentan los filtros de la página de enlaces, del generador de campañas y del selector de enlaces de las páginas bio.

## Contraseña

En **Contraseña**, define una contraseña que los visitantes deben introducir antes de llegar al destino y, si quieres, una **Pista** que aparece en la página de acceso. La protección con contraseña depende de tu plan.

## Opciones avanzadas

Despliega **Opciones avanzadas** para configurar reglas de redirección. Cada grupo muestra un resumen de una línea con su configuración actual.

- **Programación y vencimiento**: define **Disponible desde (UTC)** y **Vence el (UTC)**, un **Límite aproximado de visitas acumuladas** y una **URL alternativa cuando no esté disponible** para quien llegue fuera de ese periodo. El límite incluye los escaneos QR y es aproximado, porque varias visitas simultáneas pueden superarlo.
- **Destino por país**: envía a los visitantes de ciertos países a otras URL. Usa códigos de país de dos letras; se aplica la primera regla que coincida.
- **Destino por dispositivo**: redirige según el sistema operativo, el tipo de dispositivo o ambos.
- **Rotación ponderada**: reparte el tráfico entre hasta 10 destinos según pesos relativos. Quien vuelve mantiene el mismo destino.
- **Enlaces de aplicaciones**: abre una aplicación de iOS o Android, con alternativa al destino web o a la tienda de aplicaciones.
- **Redirección y parámetros**: reenvía los parámetros recibidos, usa una redirección permanente HTTP 301 y fija valores UTM. Consulta [Parámetros UTM](/docs/es/guides/links/utm-parameters).
- **Vista previa social**: define el título, la descripción y la imagen que muestran los robots de vista previa cuando se comparte el enlace.

## Importa enlaces desde un archivo CSV

Para crear muchos enlaces a la vez, selecciona **Importar** en la página de enlaces. Sube un archivo CSV en UTF-8 con fila de cabecera y hasta 50 000 filas, asigna sus columnas, revisa el resultado de la validación y crea los enlaces válidos. Los enlaces importados cuentan para el límite mensual de tu plan.

## Después de crear el enlace

La página del enlace tiene las pestañas **Resumen**, **Estadísticas**, **Código QR**, **Variantes UTM** y **Editar**. En la pestaña **Código QR**, selecciona **Crear un código QR** para generar un código imprimible que use este enlace.

Los cambios que guardes en **Editar** se aplican desde el siguiente clic.

## Siguientes pasos

- [Gestionar enlaces](/docs/es/guides/links/managing-links)
- [Parámetros UTM](/docs/es/guides/links/utm-parameters)
- [Crear códigos QR](/docs/es/guides/qr-codes/creating-qr-codes)
