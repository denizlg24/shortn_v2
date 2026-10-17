# Parámetros UTM

Los parámetros UTM son etiquetas en la URL, como `utm_source=newsletter`, que las herramientas de estadísticas leen para saber de dónde viene una visita. En Shortn aparecen en tres sitios: en las variantes UTM de un enlace, en el generador de UTM de una campaña y en la configuración de redirección, que decide qué parámetros llegan al destino.

## Los cinco parámetros

- `utm_source`: de dónde viene el tráfico, por ejemplo `newsletter` o `facebook`.
- `utm_medium`: el tipo de canal, por ejemplo `email` o `social`.
- `utm_campaign`: la campaña a la que pertenece la visita.
- `utm_term`: la palabra clave de búsqueda de pago. Opcional.
- `utm_content`: distingue enlaces parecidos, como `cabecera` y `pie`. Opcional.

## Añade variantes UTM a un enlace

Una variante es una versión etiquetada de un enlace corto para un canal. Las visitas que llegan por ella se cuentan por origen, medio y campaña.

1. Abre el enlace y selecciona la pestaña **Variantes UTM**.
2. Selecciona **Añadir variante**.
3. Rellena **Origen**, **Medio** y **Campaña** y, si quieres, **Término** y **Contenido**. Al elegir una campaña guardada verás sus valores sugeridos.
4. Selecciona **Guardar variante**.

La lista de variantes muestra cada **URL etiquetada**: tu enlace corto con los parámetros añadidos, por ejemplo `shortn.at/primavera?utm_source=newsletter&utm_medium=email&utm_campaign=rebajas-primavera`. Selecciona **Copiar** para copiarla.

El valor de **Campaña** vincula la variante con la campaña del mismo nombre, y así el enlace entra en esa campaña. Las variantes UTM y las campañas dependen de tu plan.

Para cambiar una variante, selecciona **Editar**. Para borrarla, selecciona **Quitar** y confirma con **Eliminar variante**. Las URL que ya hayas compartido siguen redirigiendo y sus estadísticas se conservan. Si era la última variante del enlace en una campaña, el enlace sale de esa campaña.

## Etiqueta muchos enlaces a la vez

Para etiquetar varios enlaces para el mismo canal, usa la pestaña **Generador de UTM** de una campaña. Siempre fija `utm_campaign` con el título de la campaña, te sugiere los valores guardados y guarda la misma variante en todos los enlaces que selecciones. Consulta [Organizar campañas](/docs/es/guides/campaigns/organizing-campaigns).

## Controla lo que llega al destino

La URL etiquetada lleva los parámetros hasta Shortn, que los registra con cada visita. Que pasen o no al destino depende de la configuración de redirección del enlace.

1. Abre la pestaña **Editar** del enlace y despliega **Opciones avanzadas**.
2. Abre **Redirección y parámetros**.
3. Elige la configuración:
   - **Reenviar parámetros recibidos** pasa al destino los parámetros del visitante, incluidas las etiquetas UTM.
   - Los campos `utm_source`, `utm_medium`, `utm_campaign`, `utm_term` y `utm_content` fijan valores que siempre se añaden al destino.
4. Selecciona **Guardar cambios**.

Cuando el mismo parámetro aparece en más de un sitio, se aplican estas reglas:

- un valor UTM fijado en la configuración de redirección siempre gana;
- si no, un parámetro que ya esté en la URL de destino se mantiene frente al recibido;
- los parámetros recibidos solo se reenvían con el reenvío activado.

## Lee los resultados UTM

En la página **Estadísticas**, los desgloses **Fuentes UTM**, **Medios UTM** y **Campañas UTM** agrupan las visitas por etiqueta, y puedes filtrar por cualquier valor. Los desgloses dependen de tu plan. Consulta [Entender las estadísticas](/docs/es/guides/analytics/understanding-analytics).

## Buenas prácticas

- Escribe los valores en minúsculas y usa una sola grafía por canal, para que los resultados de un mismo canal no se repartan entre varios valores.
- Usa `utm_content` para comparar ubicaciones del mismo enlace, como la cabecera y el pie.
- No añadas etiquetas UTM a enlaces que apuntan a tu propio sitio; sustituyen el origen real de la visita.

## Siguientes pasos

- [Organizar campañas](/docs/es/guides/campaigns/organizing-campaigns)
- [Gestionar enlaces](/docs/es/guides/links/managing-links)
