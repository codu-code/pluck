---
title: Ejecuta tu propio Pluck.
description: Un docker compose, 1 GB de RAM y la misma app en tu propio servidor. Todo, incluidas las partes incómodas.
keywords: leer más tarde autoalojado, alternativa a Pocket autoalojada, leer más tarde docker, gestor de marcadores autoalojado, servidor de código abierto para leer más tarde
---

Pluck en getpluck.io es gratis. El mismo código funciona en tu propio servidor, y arrancarlo es un comando.

Aquí está todo, incluidas las partes incómodas.

![Una terminal que arranca Pluck, y la misma Bandeja de entrada funcionando en la dirección de un servidor casero.](/blog/run-your-own-pluck/hero.png)

## Qué necesitas

Docker, y una máquina con 1 vCPU y 1 GB de RAM. Un VPS pequeño, un equipo viejo o la caja que tienes debajo de la tele sirven.

## Arráncalo

```
git clone https://github.com/codu-code/pluck
cd pluck
docker compose up -d
```

Abre http://localhost:3000. Pluck inicia tu sesión con un enlace por correo, y en una instalación nueva ese correo va al capturador de correo integrado en http://localhost:8025. No hace falta un servidor de correo para probarlo.

## Qué se está ejecutando

Una imagen de Docker, arrancada dos veces. Una copia sirve la app. La otra es el worker, que lee páginas, pasa al Archivo por la noche los elementos sin tocar, envía el correo de los lunes y vacía la Papelera.

Al lado: MongoDB para tu biblioteca, MinIO para las páginas conservadas y los archivos, y Mailpit para capturar el correo.

## Ponlo en una dirección de verdad

Pon delante un proxy inverso con HTTPS y luego define esto en un archivo `.env` junto al archivo de compose:

- `PLUCK_URL`, la dirección que vas a usar.
- `SMTP_URL` y `EMAIL_FROM`, para que los correos de inicio de sesión lleguen a bandejas de entrada reales.
- `S3_ACCESS_KEY` y `S3_SECRET_KEY`, en lugar de los valores por defecto.

Pluck no arranca en una dirección pública con la contraseña de almacenamiento por defecto. Es a propósito. La [guía de autoalojamiento](https://github.com/codu-code/pluck/blob/main/docs/self-host.md) recoge todos los ajustes.

## Apunta tus apps a él

- **iPhone.** Abre `pluck://signin?server=https://your.address` en el teléfono. La app inicia sesión en tu servidor.
- **Chrome.** La extensión de la tienda solo habla con getpluck.io. Compila la tuya con `PLUCK_SERVER=https://your.address pnpm --filter @pluck/extension build` y cárgala con “Cargar descomprimida”.
- **Tu IA.** Conéctala a `https://your.address/mcp`. Si el servidor no tiene dirección pública, crea una clave de API en Ajustes y usa `npx @getpluck/mcp --server https://your.address --key pk_live_…`.

## Las partes incómodas

El correo entrante necesita un servicio que reciba el correo de tu dominio y lo deje en el almacenamiento. El archivo de compose no incluye ninguno, así que la guía explica qué configurar.

Las copias de seguridad las haces tú. Haz copia de los volúmenes `mongo` y `minio`. Ahí está toda tu biblioteca.

## Actualizaciones

```
git pull && docker compose up -d --build
```

El servidor y las apps son Apache-2.0.

Si algún día paramos, tú no.
