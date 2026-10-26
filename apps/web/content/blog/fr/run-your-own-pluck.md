---
title: Hébergez votre propre Pluck.
description: Un docker compose, 1 Go de RAM, et la même app sur votre propre serveur. Tout, y compris les parties pénibles.
keywords: lire plus tard auto-hébergé, alternative à Pocket auto-hébergée, lire plus tard Docker, gestionnaire de favoris auto-hébergé, serveur de lecture différée open source
---

Pluck sur getpluck.io est gratuit. Le même code tourne sur votre propre serveur, et une commande suffit pour le lancer.

Voici le tout, parties pénibles comprises.

![Un terminal qui lance Pluck, et la même boîte de réception à l’adresse d’un serveur maison.](/blog/run-your-own-pluck/hero.png)

## Ce qu’il vous faut

Docker, et une machine avec 1 vCPU et 1 Go de RAM. Un petit VPS, un vieux portable ou le boîtier sous la télé, tout fait l’affaire.

## Le lancer

```
git clone https://github.com/codu-code/pluck
cd pluck
docker compose up -d
```

Ouvrez http://localhost:3000. Pluck vous connecte avec un lien par e-mail, et sur une installation neuve cet e-mail part vers le capteur d’e-mails intégré, à l’adresse http://localhost:8025. Pas besoin de serveur mail pour essayer.

## Ce qui tourne

Une seule image Docker, lancée deux fois. Une copie sert l’app. L’autre est le worker, qui lit les pages, passe les éléments laissés de côté aux Archives pendant la nuit, envoie l’e-mail du lundi et vide la corbeille.

À côté : MongoDB pour votre bibliothèque, MinIO pour les pages gardées et les fichiers, et Mailpit pour attraper les e-mails.

## Le mettre sur une vraie adresse

Placez devant un reverse proxy en HTTPS, puis définissez ces variables dans un fichier `.env` à côté du fichier compose :

- `PLUCK_URL`, l’adresse que vous utiliserez.
- `SMTP_URL` et `EMAIL_FROM`, pour que les e-mails de connexion arrivent dans de vraies boîtes.
- `S3_ACCESS_KEY` et `S3_SECRET_KEY`, à la place des valeurs par défaut.

Pluck refuse de démarrer sur une adresse publique avec le mot de passe de stockage par défaut. C’est voulu. Le [guide d’auto-hébergement](https://github.com/codu-code/pluck/blob/main/docs/self-host.md) liste tous les réglages.

## Y brancher vos apps

- **iPhone.** Ouvrez `pluck://signin?server=https://your.address` sur le téléphone. L’app se connecte alors à votre serveur.
- **Chrome.** L’extension du store ne parle qu’à getpluck.io. Compilez la vôtre avec `PLUCK_SERVER=https://your.address pnpm --filter @pluck/extension build` et chargez-la avec « Charger l’extension non empaquetée ».
- **Votre IA.** Connectez-la à `https://your.address/mcp`. Si le serveur n’a pas d’adresse publique, créez une clé d’API dans les Réglages et utilisez `npx @getpluck/mcp --server https://your.address --key pk_live_…`.

## Les parties pénibles

L’e-mail entrant a besoin d’un service qui reçoit le courrier de votre domaine et le dépose dans le stockage. Le fichier compose n’en contient pas, le guide explique donc quoi mettre en place.

Les sauvegardes, c’est vous. Sauvegardez les volumes `mongo` et `minio`. C’est toute votre bibliothèque.

## Mises à jour

```
git pull && docker compose up -d --build
```

Le serveur et les apps sont sous Apache-2.0.

Si un jour nous arrêtons, vous, vous continuez.
