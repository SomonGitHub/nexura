<p align="center">
  <img src="https://github.com/user-attachments/assets/10825c5c-6b7b-45da-be33-48f60f3bc58a" alt="Nexura Dashboard Desktop View" width="100%"/>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/SomonGitHub/nexura/master/brand/logo.png" alt="Nexura Logo" width="200"/>
</p>

# Nexura Dashboard

Nexura est une intégration personnalisée (Custom Component) pour Home Assistant offrant un **tableau de bord nouvelle génération**. Conçu avec React et la philosophie "Bento UI", il propose une interface utilisateur fluide, moderne (Glassmorphism), hautement personnalisable et **totalement responsive**.

## 🌟 Fonctionnalités Principales

*    🎨 **Des thèmes** Dark, light et Nature pour plaire a tout le monde ! et d'autres arrivent...
<table>
  <tr>
    <td width="33%">
      <b>Thème DARK</b><br>
      <img src="https://github.com/user-attachments/assets/10825c5c-6b7b-45da-be33-48f60f3bc58a" alt="Nexura theme dark"/>
    </td>
    <td width="33%">
      <b>Thème Light</b><br>
      <p align="center">
        <img src="https://github.com/user-attachments/assets/e98bd209-3460-4bc9-b6ef-c0fb0e616ace" alt="Nexura theme light"/>
      </p>
    </td>
    <td width="33%">
      <b>Thème Nature</b><br>
      <p align="center">
        <img src="https://github.com/user-attachments/assets/8dea6433-e191-4d48-b1fc-23ffec1d9ffd" alt="nature" />
      </p>
    </td>
  </tr>
</table>

*   🌤️ La météo sur votre dashboard : rayon du soleil, pluie, nuages ! tout est là !

*   🚨 Nouveau systeme d'alerte pour vous prévenir que quelque chose cloche dans votre pièce !
<p align="center">
  <img src="https://github.com/user-attachments/assets/4b344d5c-9e68-415b-8530-b0cd2270e74a" alt="Nexura Dashboard alert" width="10%"/>
</p>


*   📱 **Agencements Indépendants (Multi-Layout)** : Nexura enregistre la disposition de vos tuiles séparément pour vos écrans de **Bureau**, **Tablette** et **Mobile**. Ce que vous modifiez sur votre téléphone n'affecte pas l'arrangement de votre grand écran mural !
<table>
  <tr>
    <td width="33%">
      <b>Bureau</b><br>
      <img src="https://github.com/user-attachments/assets/48099c92-b1b7-46fd-8a53-f821baca6915" alt="Nexura theme dark"/>
    </td>
    <td width="33%">
      <b>Tablette 1024</b><br>
      <p align="center">
        <img src="https://github.com/user-attachments/assets/811fa97d-7fdc-477f-8047-232f6cfe4ab6" alt="Nexura theme light"/>
      </p>
    </td>
    <td width="33%">
      <b>Mobile 760</b><br>
      <p align="center">
        <img src="https://github.com/user-attachments/assets/6ab477de-11de-4c7a-8411-551cb019d57f" alt="nature" />
      </p>
    </td>
  </tr>
</table>

*   ⚡ **Drag and Drop** Vous êtes libre ! placer vos tuiles ou vous le voulez !
<p align="center">
  <img src="https://github.com/user-attachments/assets/dc609749-1dfb-4851-94f8-7e6e25f87373" alt="Nexura Dashboard Desktop View" width="50%"/>
</p>
*    📺 Un mode economiseur d'écran avec l'heure et vos alertes !
*   🪄 **Mode Édition Avancé** : Modifiez la position de vos tuiles, changez leur taille (Default, Wide, Tall, Large) ou masquez-les spécifiquement pour l'appareil que vous utilisez actuellement.
*   🌡️ **Tuiles Riches et Dynamiques** :
    *   Lumières & Prises (Toggles tactiles)
    *   Capteurs (Températures, Humidité avec mini-graphiques en fond)
    *   Variateurs (Sliders de valeurs précis)
    *   Météo
    *   Volets Roulants & Portes/Fenêtres (Contrôle précis et affichage de l'état ouvert/fermé)
    *   Scéne
    *   Média
    *   Gauge
*   ✨ **Halos Animés** : Les tuiles s'éclairent d'un léger halo de couleur qui "respire" de façon fluide, reflétant l'état de l'appareil (Bleu pour le refroidissement, Orange/Rouge pour le chaud, Vert pastel pour les capteurs d'air, etc.).
*   🖥️ **Mode "Immersion" (Plein Écran)** : Lancez le mode plein écran pour les affichages sur borne ou tablette murale. Complété par un mode d'économie d'écran s'activant automatiquement après inactivité.
*   🚪 **Filtrage par Pièces** : Utilisez la barre latérale ("Favoris" ou par "Pièce") pour filtrer dynamiquement vos tuiles et réduire le bruit visuel. Longs textes gérés élégamment avec une animation de défilement textuel (Marquee).

---

## 🛠️ Installation

### Via HACS (Recommandé)

1. Ouvrez **HACS** dans votre Home Assistant.
2. Cliquez sur les 3 points en haut à droite > **Custom repositories**.
3. Ajoutez cette URL de dépôt : `https://github.com/SomonGitHub/nexura`
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
