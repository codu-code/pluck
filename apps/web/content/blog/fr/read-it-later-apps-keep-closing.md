---
title: Les apps de lecture différée ferment les unes après les autres.
description: Pocket a fermé. Omnivore a fermé. Cinq choses à vérifier avant de confier votre bibliothèque à la suivante.
keywords: lire plus tard open source, lecture différée auto-hébergée, alternative à Pocket, Wallabag, Karakeep, Linkwarden
---

Omnivore a fermé en novembre 2024, avec environ deux semaines de préavis. Pocket a fermé en juillet 2025, avec quelques mois pour exporter. Les deux contenaient des années de choses que les gens comptaient lire.

Aucune n’a fermé à cause de ses utilisateurs. Une entreprise a décidé, et le compte à rebours a commencé.

Alors avant de faire confiance à la suivante, vérifiez cinq choses. Pluck est l’app que nous faisons, et nous lui appliquons la même liste.

![Une bibliothèque qui quitte une app sous forme de fichiers que l’on peut ouvrir : JSON, Markdown, un CSV et un zip.](/blog/read-it-later-apps-keep-closing/hero.png)

## 1. Pouvez-vous tout récupérer dès aujourd’hui ?

Pas « l’export arrive bientôt ». Pas un e-mail au support. Un bouton, aujourd’hui, et un fichier que vous pouvez ouvrir sans l’app.

Celui de Pluck est dans les Réglages, et un lien vers le zip arrive par e-mail d’ici une minute ou deux. Dedans, chaque élément en JSON, avec vos notes et vos surlignages, plus un fichier Markdown pour chaque élément et chaque liste. Chaque liste se télécharge aussi en Markdown depuis sa propre page.

## 2. Garde-t-elle la page, ou seulement le lien ?

Un lien ne marche que tant que quelqu’un d’autre garde la page en ligne. Les sites déménagent, passent derrière un paywall ou disparaissent.

Pluck garde le texte de la page quand vous la cueillez, alors votre copie est toujours là quand le site ne l’est plus. Quand une page ne peut pas être lue, Pluck le dit et propose la copie Wayback.

## 3. Le code est-il public ?

Si le code est public, l’app peut survivre à l’entreprise. Quelqu’un peut la forker, et vous pouvez lire ce qu’elle fait de vos données.

Pluck est open source : AGPL-3.0 pour le serveur, MIT pour les apps.

Cela dit, le code public ne règle pas tout. Omnivore aussi était open source.

## 4. Pouvez-vous l’héberger vous-même sans y perdre un week-end ?

C’est ce qui vous sauve quand l’entreprise disparaît, alors faire tourner votre propre copie doit être banal.

Pour Pluck, c’est `git clone`, puis `docker compose up -d`. L’app web, l’app iPhone et votre IA fonctionnent toutes avec votre serveur, et l’extension Chrome se compile pour lui avec une commande de plus. Le [guide d’auto-hébergement](https://github.com/codu-code/pluck/blob/main/docs/self-host.md) couvre l’e-mail, le stockage et l’extension.

## 5. Votre IA entre-t-elle selon vos conditions ?

Tôt ou tard, vous voudrez que votre IA cherche dans votre bibliothèque et la trie. Toute la question est de savoir qui décide.

Pluck n’a pas d’IA à l’intérieur. Votre propre outil d’IA se connecte avec un seul lien via MCP, le standard ouvert, et fait ce que vous demandez. Il ne peut rien supprimer ni rendre une liste publique, et chaque tag et chaque liste qu’il crée porte une mention. [Connecter votre IA](/connect) donne les détails.

## Les autres

Allez voir ailleurs aussi. Quelques bonnes options :

- **Wallabag** est open source et existe depuis longtemps. Il est fait pour tourner sur votre propre serveur, et il existe un hébergement payant si vous préférez vous en passer.
- **Karakeep** (anciennement Hoarder) est open source et auto-hébergé, avec un tagging par IA intégré si vous configurez un modèle.
- **Linkwarden** est open source et garde des copies des pages que vous lui donnez.
- **Raindrop**, **Readwise Reader** et **Instapaper** sont soignés, et leur code est fermé. Au moment où nous écrivons, le connecteur IA de Raindrop est une bêta réservée à son offre payante.

La place de Pluck : il est gratuit sur getpluck.io, le même code tourne sur votre propre serveur, et chaque compte a un connecteur IA. C’est une seule boîte de réception pour les articles, les vidéos, les notes, les tâches et la plaque de cuisson que vous pensez acheter.

## Si vous déménagez

Pluck importe un CSV Pocket, un zip Omnivore, un CSV Raindrop et le fichier de favoris qu’exporte votre navigateur. Tout arrive dans les Archives, trouvable par la recherche, pour que votre boîte de réception commence vide. Si vous avez gardé un export Pocket, [voici le guide](/blog/pocket-is-gone). Pour Omnivore, [celui-ci](/blog/omnivore-is-gone).

Cueillez. Triez plus tard.
