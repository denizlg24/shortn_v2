# Entender las estadísticas

Shortn cuenta cada visita a tus enlaces cortos y códigos QR. Esta guía explica qué se cuenta, cómo acotar los datos con intervalos, desgloses y filtros, cómo exportarlos y cómo se protegen los datos de los visitantes.

## Clics y escaneos

Shortn registra dos tipos de visita:

- un **clic** es una visita a través de un enlace corto, ya sea escrito, pulsado o abierto desde otro sitio;
- un **escaneo** es una visita a través de uno de tus códigos QR.

El filtro **Tipo** cambia entre **Clics y escaneos**, **Clics** y **Escaneos QR**. El resumen superior muestra también los **Visitantes únicos** y el **País principal**.

## Dónde están las estadísticas

- **Estadísticas**, en la barra lateral, cubre todo el espacio de trabajo.
- La pestaña **Estadísticas** de un enlace cubre ese enlace.
- La pestaña **Escaneos** de un código QR cubre ese código.
- La pestaña **Analíticas** de una campaña cubre los enlaces de esa campaña.
- La pestaña **Estadísticas** de una página bio muestra las vistas, los clics y la tasa de clics de la página.

Todas, salvo la de las páginas bio, comparten los mismos controles.

## Elige un intervalo de fechas

1. Abre **Intervalo de fechas** y elige **Últimos 7 días**, **Últimos 30 días**, **Últimos 90 días** o **Últimos 12 meses**, o define un **Intervalo personalizado** con las fechas **Desde** y **Hasta**.
2. Elige el **Intervalo** para agrupar el gráfico por hora, día, semana o mes.

Hasta dónde puedes retroceder depende del historial de estadísticas de tu plan. Si un intervalo empieza antes, la página te indica la fecha a partir de la cual los datos quedan fuera del período de tu plan y muestra lo que esté disponible. Consulta los [Precios](/es/pricing) para ver el historial de cada plan.

## Desgloses

Debajo del gráfico, los desgloses agrupan las visitas por:

- **Enlaces**
- **Países** y **Ciudades**
- **Orígenes**: el sitio del que llegó la visita. Directo significa que no hubo sitio de origen, como una dirección escrita, una aplicación o un escaneo QR.
- **Dispositivos**, **Navegadores** y **Sistemas operativos**
- **Fuentes UTM**, **Medios UTM** y **Campañas UTM**
- **Reglas de destino**: la regla de redirección que eligió el destino, en enlaces con reglas por país, por dispositivo o de rotación.

Cada desglose muestra las filas principales; selecciona **Ver todo** para la lista completa. Los desgloses distintos del de enlaces, y el filtrado por ellos, dependen de tu plan.

## Filtra la vista

Selecciona un valor de un desglose para filtrar toda la página por él, o abre los filtros para combinar varios, por ejemplo un enlace, un país y los dispositivos móviles. Selecciona **Quitar todo** para eliminarlos.

Todos los filtros forman parte de la dirección de la página, así que puedes guardar una vista en marcadores o compartirla con alguien que tenga acceso al espacio de trabajo.

## Exporta las estadísticas

1. Define el intervalo y los filtros que quieras.
2. Selecciona **Exportar estadísticas**.
3. En **Datos**, elige **Agregados** para totales por periodo y por grupo, o **Eventos individuales** para una fila por visita.
4. Elige el formato (CSV, o NDJSON para eventos individuales) y selecciona **Preparar exportación**.

Las exportaciones se ejecutan en segundo plano, así que puedes salir de la página. Los archivos terminados están en **Historial de exportaciones**. Archivos e historial caducan 24 horas después de prepararse. La exportación conserva el período que revisaste, aunque tu plan cambie antes de que se ejecute. La exportación CSV depende de tu plan, y la de campañas tiene su propio requisito de plan.

## Privacidad

- Las direcciones IP de los visitantes se guardan como hash.
- Las direcciones IP originales se borran a los 90 días.
- Las exportaciones de eventos individuales excluyen direcciones IP, hashes de visitantes y agentes de usuario.
- El contenido integrado en las páginas bio solo se carga cuando el visitante lo pide.

## Cómo leer los datos

- Usa los desgloses UTM para ver qué canal ha funcionado, y las reglas de destino para comparar los destinos de un mismo enlace.

## Siguientes pasos

- [Parámetros UTM](/docs/es/guides/links/utm-parameters)
- [Organizar campañas](/docs/es/guides/campaigns/organizing-campaigns)
- [Cambiar de plan](/docs/es/guides/billing/upgrading-plans)
