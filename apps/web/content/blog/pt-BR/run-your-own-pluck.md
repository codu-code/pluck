---
title: Rode o seu próprio Pluck.
description: Um docker compose, 1 GB de RAM e o mesmo app no seu próprio servidor. Tudo, incluindo as partes chatas.
keywords: ler depois auto-hospedado, alternativa ao Pocket auto-hospedada, ler depois docker, gerenciador de favoritos self-hosted, servidor de ler depois de código aberto
---

O Pluck em getpluck.io é grátis. O mesmo código roda no seu próprio servidor, e basta um comando para começar.

Aqui está tudo, incluindo as partes chatas.

![Um terminal iniciando o Pluck, e a mesma Entrada rodando no endereço de um servidor caseiro.](/blog/run-your-own-pluck/hero.png)

## Do que você precisa

Docker, e uma máquina com 1 vCPU e 1 GB de RAM. Uma VPS pequena, um notebook velho ou aquela caixinha embaixo da TV, qualquer um serve.

## Comece

```
git clone https://github.com/codu-code/pluck
cd pluck
docker compose up -d
```

Abra http://localhost:3000. O Pluck faz você entrar com um link por e-mail, e numa instalação nova esse e-mail vai para o capturador de e-mails embutido, em http://localhost:8025. Não precisa de servidor de e-mail para testar.

## O que está rodando

Uma imagem Docker, iniciada duas vezes. Uma cópia serve o app. A outra é o worker, que lê as páginas, move os itens sem mexer para o Arquivo durante a noite, manda o e-mail de segunda e esvazia a Lixeira.

Ao lado delas: MongoDB para a sua biblioteca, MinIO para as páginas e os arquivos guardados, e Mailpit para capturar os e-mails.

## Coloque num endereço de verdade

Coloque um proxy reverso com HTTPS na frente e defina estas variáveis num arquivo `.env` ao lado do arquivo do compose:

- `PLUCK_URL`, o endereço que você vai usar.
- `SMTP_URL` e `EMAIL_FROM`, para os e-mails de acesso chegarem a caixas de entrada de verdade.
- `S3_ACCESS_KEY` e `S3_SECRET_KEY`, no lugar dos valores padrão.

O Pluck não inicia num endereço público com a senha padrão do armazenamento. É de propósito. O [guia de hospedagem própria](https://github.com/codu-code/pluck/blob/main/docs/self-host.md) lista todas as configurações.

## Aponte os seus apps para ele

- **iPhone.** Abra `pluck://signin?server=https://your.address` no celular. O app passa a entrar no seu servidor.
- **Chrome.** A extensão da loja só fala com getpluck.io. Compile a sua com `PLUCK_SERVER=https://your.address pnpm --filter @pluck/extension build` e carregue com “Carregar sem compactação”.
- **Sua IA.** Conecte em `https://your.address/mcp`. Se o servidor não tiver endereço público, crie uma chave de API nas Configurações e use `npx @getpluck/mcp --server https://your.address --key pk_live_…`.

## As partes chatas

O E-mail de entrada precisa de um serviço que receba e-mails para o seu domínio e os deixe no armazenamento. O arquivo do compose não inclui um, então o guia explica o que configurar.

Os backups são com você. Faça backup dos volumes `mongo` e `minio`. Ali está a sua biblioteca inteira.

## Atualizações

```
git pull && docker compose up -d --build
```

O servidor e os apps são Apache-2.0.

Se um dia a gente parar, você não para.
