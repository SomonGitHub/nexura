<p align="center">
  <img src="https://raw.githubusercontent.com/SomonGitHub/hacs-nexura/master/docs/images/desktop.png" alt="Nexura Dashboard Desktop View" width="100%"/>
</p>

# Nexura Dashboard

Nexura est une intégration personnalisée (Custom Component) pour Home Assistant offrant un **tableau de bord nouvelle génération**. Conçu avec React et la philosophie "Bento UI", il propose une interface utilisateur fluide, moderne (Glassmorphism), hautement personnalisable et **totalement responsive**.

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)

## 🌟 Fonctionnalités Principales

*   📱 **Agencements Indépendants (Multi-Layout)** : Nexura enregistre la disposition de vos tuiles séparément pour vos écrans de **Bureau**, **Tablette** et **Mobile**. Ce que vous modifiez sur votre téléphone n'affecte pas l'arrangement de votre grand écran mural !
*   ⚡ **Drag and Drop**
*   🪄 **Mode Édition Avancé** : Modifiez la position de vos tuiles, changez leur taille (Default, Wide, Tall, Large) ou masquez-les spécifiquement pour l'appareil que vous utilisez actuellement.
*   🌡️ **Tuiles Riches et Dynamiques** :
    *   Lumières & Prises (Toggles tactiles)
    *   Capteurs (Températures, Humidité avec mini-graphiques en fond)
    *   Variateurs (Sliders de valeurs précis)
    *   Météo
    *   Volets Roulants & Portes/Fenêtres (Contrôle précis et affichage de l'état ouvert/fermé)
*   🎨 **Design "Glassmorphism" & Thèmes** : Support complet des thèmes intégrés Home Assistant (Clair, Sombre, ou Auto).
*   ✨ **Halos Animés** : Les tuiles s'éclairent d'un léger halo de couleur qui "respire" de façon fluide, reflétant l'état de l'appareil (Bleu pour le refroidissement, Orange/Rouge pour le chaud, Vert pastel pour les capteurs d'air, etc.).
*   🖥️ **Mode "Immersion" (Plein Écran)** : Lancez le mode plein écran pour les affichages sur borne ou tablette murale. Complété par un mode d'économie d'écran s'activant automatiquement après inactivité.
*   🚪 **Filtrage par Pièces** : Utilisez la barre latérale ("Favoris" ou par "Pièce") pour filtrer dynamiquement vos tuiles et réduire le bruit visuel. Longs textes gérés élégamment avec une animation de défilement textuel (Marquee).

---

## 📸 Aperçus

<table>
  <tr>
    <td width="50%">
      <b>Mode Bureau / Tablette (Édition)</b><br>
      Redimensionnez (📐), Masquez (❌), ou Déplacez (⠿) vos entités facilement.
      <br><br>
      <img src="https://raw.githubusercontent.com/SomonGitHub/hacs-nexura/master/docs/images/desktop.png" alt="Nexura Desktop Edit Mode"/>
    </td>
    <td width="50%">
      <b>Affichage Mobile Adapté</b><br>
      Une colonne claire, fluide, et indépendante de votre grand écran !
      <br><br>
      <p align="center">
        <img src="https://raw.githubusercontent.com/SomonGitHub/hacs-nexura/master/docs/images/mobile.png" alt="Nexura Mobile View" width="250"/>
      </p>
    </td>
  </tr>
</table>

---

## 🛠️ Installation

### Via HACS (Recommandé)

1. Ouvrez **HACS** dans votre Home Assistant.
2. Cliquez sur les 3 points en haut à droite > **Custom repositories**.
3. Ajoutez cette URL de dépôt : `https://github.com/SomonGitHub/hacs-nexura`
4. Sélectionnez la catégorie **Integration**.
5. Cliquez sur **Ajouter**.
6. Cherchez "Nexura Dashboard" et cliquez sur **Download**.
7. Redémarrez Home Assistant complet : `Developer Tools` -> `Restart`.

### Configuration de l'Intégration

Une fois redémarré, l'intégration backend doit être activée :

1. Allez dans **Paramètres** > **Appareils et services** > **Intégrations**.
2. Cliquez sur le bouton bleu **+ Ajouter une intégration**.
3. Recherchez **Nexura**.
4. Suivez l'assistant de configuration.
5. Une fois terminé, une nouvelle entrée de menu latéral nommée **Nexura** apparaîtra instantanément ! 🎉

## ⚙️ Configuration du Thème

Vous pouvez forcer Nexura à utiliser le mode Clair, le mode Sombre, ou à suivre le thème natif de votre Home Assistant :

1. Dans **Appareils et services**, trouvez l'intégration Nexura.
2. Cliquez sur **Configurer** (Options).
3. Choisissez "Auto", "Dark" ou "Light". La sauvegarde transmet l'ordre en direct à vos écrans qui changeront instantanément de couleur (sans rafraîchir la page !).


## 💻 Stack Technique (Informations Développeurs)

L'intégration est écrite en :
- Backend : **Python** (Composant natif utilisant l'API WebSocket de Home Assistant).
- Frontend : **React 18** avec **TypeScript** et Vite pour un rendu instantané et une gestion optimisée. Le Drag&Drop est géré via `@dnd-kit`.
