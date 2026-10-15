# 🎭 Imposteur

Version revisitée et simplifiée du jeu *Undercover*, à jouer **sur un seul téléphone** qu'on se passe autour de la table.

**Jouer :** https://nicolaswendling00-dot.github.io/imposteur/
(sur iPhone : Safari → Partager → « Sur l'écran d'accueil » pour l'installer comme une app, jouable hors ligne)

## Les rôles
- 🙂 **Civils** : ils ont tous le même mot.
- 🕵️ **Imposteur** : il a un mot proche mais différent, et ne sait pas qu'il est l'imposteur.
- 🎩 **Mr. White** : il n'a aucun mot. S'il est éliminé, il peut deviner le mot des civils pour gagner seul.

## Dans l'app
- Distribution des mots joueur par joueur, écran caché tant qu'on ne touche pas.
- Ordre de parole tiré au hasard à chaque manche, avec l'option « Mr. White peut parler en premier ».
- Bouton **👀 Mon mot** pour revoir son mot à tout moment.
- **Vote** secret (le téléphone passe de main en main) ou à main levée, avec revote ou tirage au sort en cas d'égalité.
- **Rejouer** en un geste avec les mêmes joueurs, nouveaux mots et nouveaux rôles ; scores cumulés.
- Choix des thèmes, partie sauvegardée si l'app se ferme.

## Base de mots
`data/paires.json` : 790 paires civil / imposteur réparties en 23 thèmes. Le mot donné aux civils et celui de l'imposteur sont inversés une fois sur deux, et les paires déjà jouées ne reviennent pas avant d'avoir épuisé le thème.

Après une modification de la base :

```bash
node outils/verifier.mjs
```

(vérifie le nombre de paires, les doublons et les paires aux deux mots identiques)

## Mise à jour
Changer `CACHE_NAME` dans `sw.js` à chaque nouvelle version pour que les téléphones récupèrent les fichiers à jour.
