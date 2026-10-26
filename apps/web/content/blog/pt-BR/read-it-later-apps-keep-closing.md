---
title: Os apps de ler depois continuam fechando.
description: O Pocket acabou. O Omnivore acabou. Cinco coisas para conferir antes de confiar a sua biblioteca ao próximo.
keywords: app para ler depois de código aberto, ler depois auto-hospedado, alternativa ao Pocket, Wallabag, Karakeep, Linkwarden
---

O Omnivore acabou em novembro de 2024, com cerca de duas semanas de aviso. O Pocket acabou em julho de 2025, com alguns meses para exportar. Os dois guardavam anos de coisas que as pessoas pretendiam ler.

Nenhum dos dois fechou porque os usuários fizeram algo errado. Uma empresa decidiu, e o relógio começou a correr.

Então, antes de confiar no próximo, confira cinco coisas. O Pluck é o app que a gente faz, e a gente o submete à mesma lista.

![Uma biblioteca saindo de um app como arquivos que você consegue abrir: JSON, Markdown, um CSV e um zip.](/blog/read-it-later-apps-keep-closing/hero.png)

## 1. Dá para tirar tudo hoje?

Não “a exportação está chegando”. Não um e-mail para o suporte. Um botão, hoje, e um arquivo que você abre sem o app.

O do Pluck fica nas Configurações, e um link para o zip chega por e-mail em um ou dois minutos. Dentro dele está cada item em JSON, com as suas notas e destaques, e mais um arquivo Markdown para cada item e cada lista. Qualquer lista também pode ser baixada em Markdown a partir da própria página.

## 2. Ele guarda a página, ou só o link?

Um link só funciona enquanto outra pessoa mantém a página no ar. Sites mudam de endereço, vão para trás de um paywall ou somem.

O Pluck guarda o texto da página quando você colhe, então a sua cópia continua lá quando o site já não está. Quando uma página não pode ser lida, o Pluck avisa e oferece a cópia do Wayback.

## 3. O código é público?

Se o código é público, o app pode sobreviver à empresa. Alguém pode fazer um fork, e você pode ler o que ele faz com os seus dados.

O Pluck é de código aberto: AGPL-3.0 para o servidor, MIT para os apps.

Código público não é a resposta toda, diga-se. O Omnivore também era de código aberto.

## 4. Dá para rodar por conta própria sem perder um fim de semana?

É isso que resolve quando a empresa vai embora, então rodar a sua própria cópia tem que ser algo comum.

No Pluck é `git clone`, depois `docker compose up -d`. O app web, o app do iPhone e a sua IA funcionam com o seu servidor, e a extensão do Chrome é compilada para ele com mais um comando. O [guia de hospedagem própria](https://github.com/codu-code/pluck/blob/main/docs/self-host.md) cobre e-mail, armazenamento e a extensão.

## 5. A sua IA entra nos seus termos?

Mais cedo ou mais tarde você vai querer que a sua IA busque na sua biblioteca e a organize. A questão é quem manda.

O Pluck não tem IA dentro. A sua própria ferramenta de IA se conecta com um link, por MCP, o padrão aberto, e faz o que você pede. Ela não pode apagar nada nem tornar uma lista pública, e cada tag e lista que ela cria leva uma marca. [Conecte sua IA](/connect) tem os detalhes.

## Os outros

Vale olhar em volta. Alguns bons:

- **Wallabag** é de código aberto e existe há bastante tempo. Foi feito para rodar no seu próprio servidor, e tem hospedagem paga se você preferir não fazer isso.
- **Karakeep** (antes chamado Hoarder) é de código aberto e auto-hospedado, com tags por IA dentro se você configurar um modelo.
- **Linkwarden** é de código aberto e guarda cópias das páginas que você manda para ele.
- **Raindrop**, **Readwise Reader** e **Instapaper** são bem acabados e de código fechado. Quando este texto foi escrito, o conector de IA do Raindrop era um beta no plano pago.

Onde o Pluck se encaixa: o uso em getpluck.io é grátis, o mesmo código roda no seu próprio servidor, e toda conta vem com um conector de IA. É uma Entrada só para artigos, vídeos, notas, tarefas e o cooktop que você está pensando em comprar.

## Se você está de mudança

O Pluck importa um CSV do Pocket, um zip do Omnivore, um CSV do Raindrop e o arquivo de favoritos que o seu navegador exporta. Tudo chega no Arquivo, aparecendo na busca, então a sua Entrada começa vazia. Se você guardou uma exportação do Pocket, [aqui está o passo a passo](/blog/pocket-is-gone). Para o Omnivore, [este aqui](/blog/omnivore-is-gone).

Colha agora. Organize depois.
