---
title: Omnivore ya no está. Las páginas de tu zip, sí.
description: Si conservaste tu exportación de Omnivore, Pluck lee las páginas directamente del zip. Incluso las de sitios que ya no existen.
keywords: alternativa a Omnivore, exportar Omnivore, importar zip de Omnivore, cierre de Omnivore
---

El servicio alojado de Omnivore cerró en noviembre de 2024. El equipo se fue a otra empresa, y los usuarios tuvieron unas dos semanas para sacar sus datos.

Si exportaste a tiempo, tienes un zip. Consérvalo. Casi todo lo que conservabas en Omnivore está ahí como la página en sí, no solo como un enlace a ella.

![Un zip de Omnivore desplegado en páginas completas, una de ellas abierta en el lector de Pluck.](/blog/omnivore-is-gone/hero.png)

## Qué hay en el zip

Una exportación de Omnivore es una carpeta con archivos de metadatos y, para casi todo lo que conservabas, la página en HTML.

Eso importa ahora. Algunos de esos sitios se han mudado, han cambiado o han desaparecido, y tu zip todavía tiene lo que decían.

## Tráelo

1. [Inicia sesión en Pluck](/signin). Te llega un enlace por correo. No hay contraseña.
2. Abre Ajustes y luego Importar y exportar.
3. Elige Omnivore (zip) y suelta el archivo.

La importación se hace en segundo plano, así que puedes cerrar la pestaña.

## Qué se viene contigo

- Cada enlace, con su título.
- Tus labels de Omnivore, como etiquetas.
- La fecha en que conservaste cada uno.
- El texto de la página, leído directamente del zip. Pluck no vuelve al sitio para estas, así que una página cuyo sitio ya no existe llega entera igualmente.

Para lo que no tiene página en el zip, Pluck vuelve a buscar la página, unas pocas cada vez.

## Dónde llega

Al Archivo, marcado como Importado, y todo se puede buscar, texto de las páginas incluido. Tu Bandeja de entrada sigue vacía hasta que recojas algo nuevo.

## El código abierto no bastó

Omnivore era de código abierto, y aun así desapareció. El código siguió siendo público. El servicio no, y ejecutarlo por tu cuenta era todo un proyecto.

Así que el código público es solo la mitad. Esta es la otra mitad:

- **Ejecutar tu propia copia lleva un comando.** Es `docker compose up -d` desde el [repositorio](/open-source). La app web, la app de iPhone y tu IA funcionan con tu servidor, y la extensión de Chrome se compila para él con un comando más.
- **Exportar funciona hoy.** Cada elemento sale como JSON, con tus notas y destacados, más un archivo Markdown por cada elemento y cada lista.
- **Pluck conserva la página, no solo el enlace.** La conserva en el momento en que la recoges, así que el próximo cierre se lleva menos.

## No solo Omnivore

La misma pantalla acepta un CSV de Pocket, un CSV de Raindrop y el archivo de marcadores que exporta tu navegador. Tráelos todos. Lo que esté en dos archivos se convierte en un solo elemento.

Luego recoge lo siguiente desde tu teléfono, Chrome, el correo o [tu IA](/connect).

Sigue aquí aunque el sitio ya no esté.
