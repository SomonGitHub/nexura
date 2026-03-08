# Plan d'Implémentation de Optimisation Téléphones Haute Résolution

**But :** Étendre l'affichage mobile optimisé à l'ensemble des smartphones (y compris très haute résolution) et intégrer une typographie fluide basée sur la taille réelle de la tuile.

**Architecture :** 
1. Extension du breakpoint Mobile de `480px` vers `767px` dans `BentoGrid.css` et `BentoTile.css`.
2. Définition de la classe `.bento-tile` comme un conteneur (`container-type: inline-size`) pour permettre aux éléments enfants de réagir selon sa largeur (`cqw`).
3. Modification de `SensorContent.css` pour remplacer les polices fixes par la fonction CSS `clamp(min, preferred_cqw, max)` afin que le texte rétrécisse sans se couper si la tuile est modifiée.

**Stack Technique :** CSS pur, Media Queries, Container Queries (`@container`, `cqw`, `clamp()`).

---

### Tâche 1 : Étendre le Breakpoint Mobile (BentoGrid & BentoTile)

**Fichiers :**
- Modifier : `custom_components/nexura/frontend/src/components/BentoGrid/BentoGrid.css`
- Modifier : `custom_components/nexura/frontend/src/components/BentoTile/BentoTile.css`

**Étape 1 : Augmenter le max-width dans BentoGrid.css**

```css
/* Remplacer @media (max-width: 480px) par 767px dans BentoGrid.css */
@media (max-width: 767px) {
  .bento-grid { ... }
}
```

**Étape 2 : Augmenter le max-width dans BentoTile.css**

```css
/* Remplacer @media (max-width: 480px) par 767px dans BentoTile.css */
@media (max-width: 767px) {
    .tile-mini { ... }
}
```

**Étape 3 : Commiter**

```bash
git add custom_components/nexura/frontend/src/components/BentoGrid/BentoGrid.css custom_components/nexura/frontend/src/components/BentoTile/BentoTile.css
git commit -m "style: expand mobile breakpoint to 767px for high-res smartphones"
```

---

### Tâche 2 : Définir le conteneur sur BentoTile

**Fichiers :**
- Modifier : `custom_components/nexura/frontend/src/components/BentoTile/BentoTile.css`

**Étape 1 : Ajouter la propriété container**

```css
/* Dans BentoTile.css, ajouter à `.bento-tile` */
.bento-tile {
    /* ... css existant ... */
    contain: layout style;
    container-type: inline-size;
}
```

**Étape 2 : Commiter**

```bash
git add custom_components/nexura/frontend/src/components/BentoTile/BentoTile.css
git commit -m "style: add container-type query support to bento tile"
```

---

### Tâche 3 : Appliquer la Typographie Dynamique (SensorContent)

**Fichiers :**
- Modifier : `custom_components/nexura/frontend/src/components/Tiles/SensorContent.css`

**Étape 1 : Mettre à jour les tailles de police avec clamp()**

```css
/* Modifier .sensor-value */
.sensor-value {
    /* Remplacer font-size: 2.8rem; par un clamp adaptatif */
    /* Min 1.5rem, idéal: 15% largeur de tuile, Max 2.8rem */
    font-size: clamp(1.5rem, 15cqw, 2.8rem);
    /* ... reste du css existant ... */
}

/* Modifier .sensor-label pour le sous-titre */
.sensor-label {
    /* Remplacer font-size: 0.85rem; par un clamp */
    /* Min 0.65rem, idéal: 6cqw, Max: 0.85rem */
    font-size: clamp(0.65rem, 6cqw, 0.85rem);
    /* S'assurer que le texte tronqué soit élégant s'il déborde malgré tout */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    /* ... reste du css ... */
}

/* Adapter selon la classe tile-small existante */
.tile-small .sensor-value {
    /* Remplacer 2.2rem par un clamp */
    font-size: clamp(1.2rem, 18cqw, 2.2rem);
}
```

**Étape 2 : Commiter**

```bash
git add custom_components/nexura/frontend/src/components/Tiles/SensorContent.css
git commit -m "style: apply dynamic typography with container queries on sensor titles"
```

---

### Tâche 4 : Vérification et Build

**Étape 1 : Test**
- Lancer le frontend (npm run dev).
- Modifier la taille de l'écran entre 480px et 767px -> La grille doit garder de larges tuiles (`span 4`).
- Pour les tuiles "Capteur", observer que le texte `.sensor-value` diminue fluidement de taille au lieu de se chevaucher ou se couper si on réduit horizontalement une tuile (`span 2` sur mobile par exemple).

**Étape 2 : Build pour l'utilisateur**
- Lancer la compilation (cmd ou bash) de l'assets final pour le composant.
