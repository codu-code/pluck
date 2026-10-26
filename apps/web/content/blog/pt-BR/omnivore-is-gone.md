---
title: O Omnivore acabou. As páginas no seu zip, não.
description: Se você guardou a sua exportação do Omnivore, o Pluck lê as páginas direto do zip. Até as dos sites que já não existem.
keywords: alternativa ao Omnivore, exportar Omnivore, importar zip do Omnivore, Omnivore encerrado
---

O serviço hospedado do Omnivore foi encerrado em novembro de 2024. A equipe foi para outra empresa, e os usuários tiveram cerca de duas semanas para tirar os seus dados.

Se você exportou a tempo, tem um zip. Guarde. A maior parte do que você guardou no Omnivore está lá como a própria página, não só como um link para ela.

![Um zip do Omnivore aberto em páginas inteiras, uma delas aberta no leitor do Pluck.](/blog/omnivore-is-gone/hero.png)

## O que tem no zip

Uma exportação do Omnivore é uma pasta com arquivos de metadados e, para a maioria das coisas que você guardou, a página em HTML.

Isso importa agora. Alguns desses sites mudaram de endereço, mudaram de conteúdo ou sumiram, e o seu zip ainda tem o que eles diziam.

## Traga para o Pluck

1. [Entre no Pluck](/signin). Você recebe um link por e-mail. Não tem senha.
2. Abra Configurações, depois Importar e exportar.
3. Escolha Omnivore (zip) e solte o arquivo.

A importação roda em segundo plano, então você pode fechar a aba.

## O que vem junto

- Cada link, com o título.
- Os seus rótulos, como tags.
- A data em que você guardou cada um.
- O texto da página, lido direto do zip. O Pluck não volta ao site para buscar essas páginas, então uma página cujo site sumiu chega inteira mesmo assim.

Para o que não tem página no zip, o Pluck busca a página de novo, algumas de cada vez.

## Onde chega

No Arquivo, com a marca Importado, e tudo aparece na busca, texto das páginas incluído. A sua Entrada fica vazia até você colher algo novo.

## Código aberto não bastou

O Omnivore era de código aberto, e mesmo assim acabou. O código continuou público. O serviço não, e rodar por conta própria era um projeto.

Então código público é só metade da história. A outra metade:

- **Rodar o seu leva um comando.** É `docker compose up -d` a partir do [repositório](/open-source). O app web, o app do iPhone e a sua IA funcionam com o seu servidor, e a extensão do Chrome é compilada para ele com mais um comando.
- **A exportação funciona hoje.** Cada item sai em JSON, com as suas notas e destaques, e mais um arquivo Markdown para cada item e cada lista.
- **O Pluck guarda a página, não só o link.** Ela é guardada quando você colhe, então o próximo encerramento leva menos coisa junto.

## Não só o Omnivore

A mesma tela aceita um CSV do Pocket, um CSV do Raindrop e o arquivo de favoritos que o seu navegador exporta. Traga todos. O que estiver em dois arquivos vira um item só.

Depois, colha a próxima coisa pelo celular, pelo Chrome, pelo e-mail ou pela [sua IA](/connect).

Continua aqui quando o site já não está.
