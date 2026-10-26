---
title: Omnivore n’est plus. Les pages de votre zip, si.
description: Si vous avez gardé votre export Omnivore, Pluck lit les pages directement dans le zip. Même celles dont le site a disparu.
keywords: alternative à Omnivore, export Omnivore, importer zip Omnivore, fermeture Omnivore
---

Le service hébergé d’Omnivore a fermé en novembre 2024. L’équipe a rejoint une autre entreprise, et les utilisateurs ont eu environ deux semaines pour récupérer leurs données.

Si vous avez exporté à temps, vous avez un zip. Gardez-le. L’essentiel de ce que vous gardiez dans Omnivore s’y trouve sous forme de page, pas seulement de lien.

![Un zip Omnivore déplié en pages entières, dont une ouverte dans le lecteur de Pluck.](/blog/omnivore-is-gone/hero.png)

## Ce qu’il y a dans le zip

Un export Omnivore, c’est un dossier de fichiers de métadonnées et, pour la plupart des choses que vous gardiez, la page en HTML.

Aujourd’hui, ça compte. Certains de ces sites ont déménagé, changé ou disparu, et votre zip a toujours ce qu’ils disaient.

## Le faire venir

1. [Connectez-vous à Pluck](/signin). Vous recevez un lien par e-mail. Pas de mot de passe.
2. Ouvrez les Réglages, puis Import et export.
3. Choisissez Omnivore (zip) et déposez le fichier.

L’import tourne en arrière-plan, vous pouvez donc fermer l’onglet.

## Ce qui vient avec

- Chaque lien, avec son titre.
- Vos labels, sous forme de tags.
- La date à laquelle vous avez gardé chacun.
- Le texte de la page, lu directement dans le zip. Pluck ne retourne pas sur le site pour celles-là, donc une page dont le site a disparu arrive quand même entière.

Pour tout ce qui n’a pas de page dans le zip, Pluck va rechercher la page, quelques-unes à la fois.

## Où ça arrive

Dans les Archives, marqué Importé, et tout est trouvable par la recherche, texte des pages compris. Votre boîte de réception reste vide jusqu’à ce que vous cueilliez quelque chose de nouveau.

## L’open source ne suffisait pas

Omnivore était open source, et il a quand même disparu. Le code est resté public. Le service, non, et le faire tourner soi-même était tout un chantier.

Le code public n’est donc que la moitié de l’histoire. Voici l’autre moitié :

- **Héberger le vôtre tient en une commande.** C’est `docker compose up -d` depuis le [dépôt](/open-source). L’app web, l’app iPhone et votre IA fonctionnent toutes avec votre serveur, et l’extension Chrome se compile pour lui avec une commande de plus.
- **L’export marche dès aujourd’hui.** Chaque élément sort en JSON, avec vos notes et vos surlignages, plus un fichier Markdown pour chaque élément et chaque liste.
- **Pluck garde la page, pas seulement le lien.** Elle est gardée au moment où vous la cueillez, alors la prochaine fermeture emportera moins de choses avec elle.

## Pas seulement Omnivore

Le même écran accepte un CSV Pocket, un CSV Raindrop et le fichier de favoris qu’exporte votre navigateur. Importez-les tous. Ce qui figure dans deux fichiers devient un seul élément.

Puis cueillez la suite depuis votre téléphone, Chrome, vos e-mails ou [votre IA](/connect).

Toujours là quand le site ne l’est plus.
