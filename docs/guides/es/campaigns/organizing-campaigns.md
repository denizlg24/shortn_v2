# Organizar campañas

Una campaña agrupa las variantes UTM de tus enlaces para que puedas leer sus clics en conjunto. Su título es el valor de `utm_campaign`, guarda valores sugeridos para los demás parámetros UTM y su generador de UTM etiqueta muchos enlaces de una vez. Las campañas dependen de tu plan; si el tuyo no las incluye, la página de campañas te dice qué plan las incluye.

## Crea una campaña

1. Abre **Campañas** en la barra lateral y selecciona **Nueva campaña**.
2. Escribe un **Título**. Se usa como `utm_campaign` en las URL que etiquetes, así que escríbelo tal como quieres verlo en tus estadísticas, por ejemplo `rebajas-primavera`.
3. Si quieres, añade una **Descripción**.
4. Selecciona **Crear campaña**.

La campaña se abre con las pestañas **Resumen**, **Analíticas**, **Generador de UTM** y **Ajustes**.

## Define los valores UTM sugeridos

Abre **Ajustes** y rellena los **Valores UTM predeterminados**: listas de fuentes, medios, términos y contenidos sugeridos. Escribe un valor y pulsa Intro para añadirlo. Los valores se guardan en minúsculas. El generador de UTM y el formulario de variantes del enlace te los sugieren, lo que mantiene la misma grafía en todo el equipo.

Si cambias el título de la campaña, las variantes guardadas pasan al título nuevo. Las URL que ya hayas compartido mantienen el antiguo, y sus clics dejan de contar en la campaña.

## Añade enlaces con el generador de UTM

1. Abre **Generador de UTM**, o selecciona **Crear una URL etiquetada** en el resumen.
2. En **Enlaces**, selecciona **Explorar enlaces**. Filtra por etiquetas, busca o agrupa los resultados por etiqueta. Marca enlaces en todas las páginas que necesites, o usa **Seleccionar todos los resultados**, y después selecciona **Usar … enlaces seleccionados**.
3. Rellena **Fuente**, **Medio** y, si quieres, **Término** y **Contenido**. `utm_campaign` es siempre el título de la campaña.
4. Revisa la vista previa de la **URL etiquetada** y selecciona **Copiar URL** si la necesitas ya.
5. Selecciona **Guardar como variante**. Con varios enlaces seleccionados, el botón guarda la misma variante en todos.

Un enlace entra en la campaña cuando una de sus variantes UTM usa esa campaña. Hasta que guardes la variante, sus clics no cuentan en la campaña.

También puedes añadir variantes enlace a enlace desde la pestaña **Variantes UTM** de cada enlace; consulta [Parámetros UTM](/docs/es/guides/links/utm-parameters).

## Mueve enlaces existentes a una campaña

En **Enlaces**, selecciona los enlaces que quieras, de varias páginas y filtros, y elige **Mover a campaña**. Elige la **Campaña de destino** y selecciona **Mover enlaces seleccionados**. Cada variante UTM conserva su fuente, medio, término y contenido, y los valores predeterminados de la campaña no los sobrescriben.

## Lee los resultados de la campaña

El **Resumen** muestra los clics, escaneos y visitantes de los últimos 30 días, y **Enlaces y variantes** lista cada enlace con sus URL etiquetadas y sus clics. Selecciona **Copiar utm_campaign** para copiar el valor exacto.

La pestaña **Analíticas** abre las estadísticas completas filtradas por la campaña, con los mismos intervalos de fechas, desgloses y filtros que la página **Estadísticas** del espacio de trabajo. Exportar en CSV las estadísticas de una campaña depende de tu plan. Consulta [Entender las estadísticas](/docs/es/guides/analytics/understanding-analytics).

## Encuentra campañas

La lista de campañas tiene el campo **Buscar**, para títulos y descripciones, y **Ordenar por**, con las opciones más recientes, más antiguas, más enlaces o título.

## Elimina una campaña

En el resumen, selecciona **Eliminar campaña** y confirma. Sus variantes UTM se quitan de los enlaces y sus valores predeterminados se borran. Los enlaces siguen funcionando. Las URL ya compartidas con su `utm_campaign` conservan sus clics, pero ninguna página de campaña los muestra.

## Consejos

- Acordad en el equipo un esquema de nombres para los títulos, como `temporada-año-producto`, antes de empezar a etiquetar.
- Usa `utm_content` para comparar ubicaciones del mismo enlace dentro de un canal.

## Siguientes pasos

- [Parámetros UTM](/docs/es/guides/links/utm-parameters)
- [Entender las estadísticas](/docs/es/guides/analytics/understanding-analytics)
