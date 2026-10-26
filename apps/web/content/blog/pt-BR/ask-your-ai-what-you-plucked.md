---
title: Pergunte à sua IA o que você colheu.
description: Um link coloca a sua biblioteca inteira no Claude, no ChatGPT, no Cursor ou em qualquer ferramenta de IA que fale MCP. Trinta segundos, e ela nunca apaga nada.
keywords: MCP ler depois, servidor MCP para artigos, conectar Claude a lista de leitura, ChatGPT lista de leitura, conector Claude
---

Em março você colheu uma receita de orzo com tomate assado devagar, aquela de 30 minutos. Você sabe que colheu, mas não acha.

A sua IA acha. Dê um link a ela e ela lê a sua biblioteca inteira do Pluck: os títulos, as suas notas, as suas tags, as suas listas e o texto de cada página que o Pluck guardou.

![Uma pergunta a uma ferramenta de IA, respondida a partir de uma biblioteca do Pluck.](/blog/ask-your-ai-what-you-plucked/hero.png)

## Aqui dentro não tem IA

O Pluck nunca envia por conta própria o que você colhe para um modelo. Nada ganha tag pelas suas costas, e nenhum resumo aparece do nada.

A sua IA entra quando você a conecta e faz o que você pede. Ela se conecta por MCP, o padrão aberto que as ferramentas de IA usam para se ligar a apps. O Pluck fala MCP, então qualquer ferramenta que também fale pode se conectar: Claude, ChatGPT, Cursor e as outras.

## Conecte

O link é o mesmo para todas as ferramentas:

```
https://getpluck.io/mcp
```

- **Claude.** Configurações, depois Conectores. Escolha Adicionar conector personalizado e cole o link. Depois de adicionado, funciona na web, no computador e no celular.
- **ChatGPT.** Configurações, depois Conectores. Escolha Criar e cole o link como URL do servidor MCP. Você precisa de um plano que permita conectores personalizados.
- **Claude Code.** Uma linha no terminal, logo abaixo.
- **Cursor.** Configurações, depois MCP. Adicione um servidor com o link.

```
claude mcp add --transport http pluck https://getpluck.io/mcp
```

Na primeira vez, cada uma pede para você entrar no Pluck, e é só isso. [Conecte sua IA](/connect) tem os mesmos passos, com um botão de copiar.

## Depois, pergunte

- “O que eu colhi sobre Lisboa?”
- “Arrume a minha Entrada do Pluck.” Ela sugere tags a partir das que você já tem, e manter, depois ou arquivar para cada item. Você aceita ou muda, tudo de uma vez.
- “Faça uma lista de leitura sobre pão de fermentação natural, o melhor primeiro.” Ela busca, lê e monta uma lista em ordem, com uma linha sobre por que cada item está ali. A lista fica privada até você dizer o contrário.
- “Três ideias de post a partir do que eu colhi esta semana.” Ela lê os cinco melhores inteiros e rascunha três ângulos, com as fontes.
- “Faça a minha revisão semanal.” O e-mail de segunda em forma de conversa, uma decisão de cada vez.
- “Colha isto como nota: perguntar à Aoife sobre os montadores.” Vai para a sua Entrada como Nota.

## O que ela não pode fazer

- Apagar qualquer coisa. O Pluck não dá essa permissão.
- Tornar uma lista pública. Só você pode, pela lista no Pluck.
- Criar uma tag que você não pediu, ou renomear uma que você criou.
- Mudar o objetivo de uma lista.

Cada tag e cada lista que ela cria leva a marca “pela IA”. Se você não gostar de uma semana das tags dela, as Configurações desfazem essas tags com um toque.

![Uma lista do Pluck feita por uma ferramenta de IA, com a marca pela IA em argila.](/blog/ask-your-ai-what-you-plucked/marked.png)

## Desconecte

Configurações, depois Ferramentas de IA, depois Desconectar. Para na hora, não no fim de uma sessão.

## Rodando o seu próprio Pluck

Hospeda o seu e não tem endereço público? Crie uma chave de API nas Configurações e faça a ponte localmente:

```
npx @pluck/mcp --server https://pluck.your.host --key pk_live_…
```

Você tem as mesmas ferramentas e os mesmos prompts, apontados para o seu servidor.

Aqui dentro não tem IA. Traga a sua.
