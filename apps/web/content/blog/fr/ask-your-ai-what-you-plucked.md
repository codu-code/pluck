---
title: Demandez à votre IA ce que vous avez cueilli.
description: Un lien, et toute votre bibliothèque est dans Claude, ChatGPT, Cursor ou n’importe quel outil d’IA qui parle MCP. Trente secondes, et rien n’est jamais supprimé.
keywords: lecture différée MCP, serveur MCP pour articles, connecter Claude à sa liste de lecture, ChatGPT liste de lecture, connecteur Claude
---

En mars, vous avez cueilli une recette d’orzo aux tomates confites, celle en 30 minutes. Vous savez que vous l’avez fait, mais impossible de la retrouver.

Votre IA, elle, la retrouve. Donnez-lui un lien et elle lit toute votre bibliothèque Pluck : les titres, vos notes, vos tags, vos listes et le texte de chaque page gardée par Pluck.

![Une question posée à un outil d’IA, avec la réponse tirée d’une bibliothèque Pluck.](/blog/ask-your-ai-what-you-plucked/hero.png)

## Pas d’IA ici

Pluck n’envoie jamais de lui-même ce que vous cueillez à un modèle. Rien n’est tagué dans votre dos, et aucun résumé n’apparaît.

Votre IA entre en jeu quand vous la connectez, et fait ce que vous demandez. Elle se connecte via MCP, le standard ouvert que les outils d’IA utilisent pour se brancher sur des apps. Pluck le parle, donc tout outil qui le parle aussi peut se connecter : Claude, ChatGPT, Cursor et les autres.

## La connecter

Le lien est le même pour tous les outils :

```
https://getpluck.io/mcp
```

- **Claude.** Paramètres, puis Connecteurs. Choisissez Ajouter un connecteur personnalisé et collez le lien. Une fois ajouté, il fonctionne sur le web, sur ordinateur et sur téléphone.
- **ChatGPT.** Paramètres, puis Connecteurs. Choisissez Créer et collez le lien comme URL du serveur MCP. Il vous faut un abonnement qui autorise les connecteurs personnalisés.
- **Claude Code.** Une ligne dans un terminal, ci-dessous.
- **Cursor.** Paramètres, puis MCP. Ajoutez un serveur avec le lien.

```
claude mcp add --transport http pluck https://getpluck.io/mcp
```

La première fois, chacun vous demande de vous connecter à Pluck, et c’est tout. [Connecter votre IA](/connect) reprend les mêmes étapes, avec un bouton pour copier.

## Puis demandez

- « Qu’est-ce que j’ai cueilli sur Lisbonne ? »
- « Range ma boîte de réception Pluck. » Elle propose des tags parmi ceux que vous avez déjà, et pour chaque élément : garder, plus tard ou archiver. Vous acceptez ou vous modifiez, tout en une fois.
- « Fais une liste de lecture sur le levain, les meilleurs d’abord. » Elle cherche, lit et construit une liste dans l’ordre, avec une ligne sur ce que chacun fait là. La liste reste privée tant que vous ne dites pas le contraire.
- « Trois idées d’articles de blog à partir de ce que j’ai cueilli cette semaine. » Elle lit en entier les cinq meilleurs et propose trois angles, avec leurs sources.
- « Fais ma revue de la semaine. » L’e-mail du lundi en conversation, une décision à la fois.
- « Cueille ça comme note : demander à Aoife le contact des poseurs. » Elle arrive dans votre boîte de réception, en note.

## Ce qu’elle ne peut pas faire

- Supprimer quoi que ce soit. Pluck ne lui en donne pas l’autorisation.
- Rendre une liste publique. C’est à vous de le faire, depuis la liste dans Pluck.
- Créer un tag que vous n’avez pas demandé, ou renommer un tag que vous avez créé.
- Changer l’objectif d’une liste.

Chaque tag et chaque liste qu’elle crée porte la mention « par l’IA ». Si une semaine de ses tags ne vous plaît pas, les Réglages les retirent d’un seul geste.

![Une liste Pluck créée par un outil d’IA, avec la mention « par l’IA » couleur argile.](/blog/ask-your-ai-what-you-plucked/marked.png)

## La déconnecter

Réglages, puis Outils d’IA, puis Déconnecter. Elle s’arrête aussitôt, pas à la fin d’une session.

## Si vous hébergez votre propre Pluck

Auto-hébergé, sans adresse publique ? Créez une clé d’API dans les Réglages et faites le pont en local :

```
npx @pluck/mcp --server https://pluck.your.host --key pk_live_…
```

Vous avez les mêmes outils et les mêmes prompts, pointés vers votre serveur.

Pas d’IA ici. Apportez la vôtre.
