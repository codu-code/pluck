---
title: Las apps para leer más tarde no paran de cerrar.
description: Pocket se fue. Omnivore se fue. Cinco cosas que comprobar antes de confiarle tu biblioteca a la siguiente.
keywords: leer más tarde código abierto, leer más tarde autoalojado, alternativa a Pocket, Wallabag, Karakeep, Linkwarden
---

Omnivore se fue en noviembre de 2024, con unas dos semanas de aviso. Pocket se fue en julio de 2025, con unos meses para exportar. Las dos tenían años de cosas que la gente pensaba leer.

Ninguna cerró porque sus usuarios hicieran algo mal. Una empresa lo decidió, y empezó a correr el reloj.

Así que, antes de confiar en la siguiente, comprueba cinco cosas. Pluck es la app que hacemos, y le exigimos la misma lista.

![Una biblioteca que sale de una app como archivos que puedes abrir: JSON, Markdown, un CSV y un zip.](/blog/read-it-later-apps-keep-closing/hero.png)

## 1. ¿Puedes sacarlo todo hoy?

No “la exportación está al llegar”. No un correo a soporte. Un botón, hoy, y un archivo que puedes abrir sin la app.

El de Pluck está en Ajustes, y el enlace al zip te llega por correo en un minuto o dos. Dentro está cada elemento como JSON, con tus notas y destacados, más un archivo Markdown por cada elemento y cada lista. Cualquier lista también se descarga en Markdown desde su propia página.

## 2. ¿Conserva la página, o solo el enlace?

Un enlace solo funciona mientras otro mantenga la página en pie. Los sitios se mudan, se esconden tras un muro de pago o desaparecen.

Pluck conserva el texto de la página cuando la recoges, así que tu copia sigue ahí aunque el sitio ya no esté. Cuando una página no se puede leer, Pluck lo dice y te ofrece la copia de Wayback.

## 3. ¿El código es público?

Si el código es público, la app puede sobrevivir a la empresa. Alguien puede hacer un fork, y tú puedes leer qué hace con tus datos.

Pluck es de código abierto: AGPL-3.0 para el servidor, MIT para las apps.

Ojo, el código público no lo resuelve todo. Omnivore también era de código abierto.

## 4. ¿Puedes ejecutarlo tú sin perder un fin de semana?

Esto es lo que te salva cuando la empresa desaparece, así que ejecutar tu propia copia tiene que ser algo normal.

En Pluck es `git clone` y luego `docker compose up -d`. La app web, la app de iPhone y tu IA funcionan con tu servidor, y la extensión de Chrome se compila para él con un comando más. La [guía de autoalojamiento](https://github.com/codu-code/pluck/blob/main/docs/self-host.md) cubre el correo, el almacenamiento y la extensión.

## 5. ¿Tu IA entra con tus condiciones?

Tarde o temprano querrás que tu IA busque en tu biblioteca y la ordene. La pregunta es quién manda.

Pluck no tiene IA dentro. Tu propia herramienta de IA se conecta con un enlace por MCP, el estándar abierto, y hace lo que le pides. No puede eliminar nada ni hacer pública una lista, y cada etiqueta y lista que crea queda marcada. En [Conecta tu IA](/connect) están los detalles.

## Las demás

Deberías mirar alrededor. Algunas buenas:

- **Wallabag** es de código abierto y lleva mucho tiempo en esto. Está pensada para ejecutarla en tu propio servidor, y hay alojamiento de pago si prefieres no hacerlo.
- **Karakeep** (antes Hoarder) es de código abierto y autoalojada, con etiquetado por IA dentro si configuras un modelo.
- **Linkwarden** es de código abierto y conserva copias de las páginas que le das.
- **Raindrop**, **Readwise Reader** e **Instapaper** están muy pulidas y son de código cerrado. En el momento de escribir esto, el conector de IA de Raindrop es una beta de su plan de pago.

Dónde encaja Pluck: es gratis en getpluck.io, el mismo código funciona en tu propio servidor, y cada cuenta trae un conector de IA. Es una sola bandeja de entrada para artículos, videos, notas, tareas y la placa de inducción que estás pensando en comprar.

## Si te mudas

Pluck importa un CSV de Pocket, un zip de Omnivore, un CSV de Raindrop y el archivo de marcadores que exporta tu navegador. Todo llega al Archivo y se puede buscar, así que tu Bandeja de entrada empieza vacía. Si conservaste una exportación de Pocket, [aquí está la guía](/blog/pocket-is-gone). Para Omnivore, [esta otra](/blog/omnivore-is-gone).

Recógelo. Ordénalo después.
