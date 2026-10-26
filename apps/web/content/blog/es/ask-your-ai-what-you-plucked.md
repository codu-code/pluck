---
title: Pregúntale a tu IA qué recogiste.
description: Un enlace lleva toda tu biblioteca a Claude, ChatGPT, Cursor o cualquier herramienta de IA que hable MCP. Treinta segundos, y nunca elimina nada.
keywords: leer más tarde MCP, servidor MCP para artículos, conectar Claude a lista de lectura, lista de lectura ChatGPT, conector de Claude
---

En marzo recogiste una receta de orzo con tomate asado a fuego lento, la de 30 minutos. Sabes que la recogiste, pero no la encuentras.

Tu IA sí. Dale un enlace y lee toda tu biblioteca de Pluck: los títulos, tus notas, tus etiquetas, tus listas y el texto de cada página que Pluck conservó.

![Una pregunta a una herramienta de IA, respondida desde una biblioteca de Pluck.](/blog/ask-your-ai-what-you-plucked/hero.png)

## Aquí dentro no hay IA

Pluck nunca envía por su cuenta lo que recoges a un modelo. Nada se etiqueta a tus espaldas, y no aparecen resúmenes.

Tu IA entra cuando tú la conectas y hace lo que le pides. Se conecta por MCP, el estándar abierto que usan las herramientas de IA para conectarse con apps. Pluck lo habla, así que cualquier herramienta que también lo hable puede conectarse: Claude, ChatGPT, Cursor y las demás.

## Conéctala

El enlace es el mismo para todas las herramientas:

```
https://getpluck.io/mcp
```

- **Claude.** Configuración y luego Conectores. Elige Añadir conector personalizado y pega el enlace. Una vez añadido, funciona en la web, en el escritorio y en el teléfono.
- **ChatGPT.** Configuración y luego Conectores. Elige Crear y pega el enlace como URL del servidor MCP. Necesitas un plan que permita conectores personalizados.
- **Claude Code.** Una línea en una terminal, aquí abajo.
- **Cursor.** Configuración y luego MCP. Añade un servidor con el enlace.

```
claude mcp add --transport http pluck https://getpluck.io/mcp
```

La primera vez, cada una te pide que inicies sesión en Pluck, y nada más. En [Conecta tu IA](/connect) están los mismos pasos, con un botón para copiar.

## Y luego pregunta

- “¿Qué recogí sobre Lisboa?”
- “Ordena mi bandeja de entrada de Pluck.” Propone etiquetas de entre las que ya tienes y, para cada elemento, si conservarlo, dejarlo para más tarde o archivarlo. Tú dices que sí o lo cambias, todo de una vez.
- “Haz una lista de lectura sobre masa madre, lo mejor primero.” Busca, lee y crea una lista en orden, con una línea sobre por qué está cada uno. La lista sigue siendo privada hasta que digas lo contrario.
- “Tres ideas para el blog a partir de lo que recogí esta semana.” Lee completos los cinco mejores y redacta tres enfoques, con fuentes.
- “Haz mi revisión semanal.” El correo de los lunes, en forma de conversación. Una decisión cada vez.
- “Recoge esto como nota: preguntarle a Aoife por los instaladores.” Llega a tu Bandeja de entrada como Nota.

## Lo que no puede hacer

- Eliminar nada. Pluck no le da ese permiso.
- Hacer pública una lista. Solo tú puedes, desde la lista en Pluck.
- Crear una etiqueta que no pediste, o cambiar el nombre de una que creaste tú.
- Cambiar para qué es una lista.

Cada etiqueta y cada lista que crea lleva la marca “por IA”. Si no te gusta una semana de su etiquetado, en Ajustes puedes quitar esas etiquetas con un toque.

![Una lista de Pluck creada por una herramienta de IA, con la marca por IA en color arcilla.](/blog/ask-your-ai-what-you-plucked/marked.png)

## Desconéctala

Ajustes, luego Herramientas de IA y luego Desconectar. Se corta al instante, no al final de una sesión.

## Si tienes tu propio Pluck

¿Lo tienes autoalojado y sin dirección pública? Crea una clave de API en Ajustes y conéctalo en local:

```
npx @pluck/mcp --server https://pluck.your.host --key pk_live_…
```

Tienes las mismas herramientas y los mismos prompts, apuntando a tu servidor.

Aquí dentro no hay IA. Trae la tuya.
