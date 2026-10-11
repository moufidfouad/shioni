# Flows Maestro — Phase 4 (itération 81)

Maestro plutôt que Detox (plan mobile, section 6) : pas de projet à compiler
à part (Detox exige son propre binaire de test packagé avec l'app), juste
des fichiers YAML rejoués contre un APK/build déjà installé — le choix le
plus léger, cohérent avec la difficulté déjà rencontrée cette itération pour
obtenir ne serait-ce qu'un premier build natif fonctionnel sur la machine de
l'utilisateur (voir `README.md` racine, itérations 79-80 et la note du
2026-09-23).

## Limite assumée — NON exécutés dans cet environnement

**Aucun de ces flows n'a pu être exécuté ici** : Maestro pilote une app
installée sur un émulateur/simulateur ou un appareil réel, aucun des deux
n'est disponible dans ce bac à sable (même limite que l'absence de vrai
backend/Postgres pour les tests Playwright du web, ou que l'absence de dev
client mobile pour vérifier `react-native-mmkv`/les notifications push au
runtime, voir `mobile/README.md`). Ces flows sont écrits contre le texte et
la structure RÉELS des écrans (vérifiés en lisant le code, pas devinés) mais
n'ont reçu AUCUNE vérification d'exécution — à rejouer une première fois par
l'utilisateur (ou en CI) avant de leur faire confiance.

## Prérequis pour les exécuter réellement

1. [Installer la CLI Maestro](https://maestro.mobile.dev/getting-started/installing-maestro).
2. Un dev client ou build EAS installé sur un émulateur/simulateur démarré
   (Maestro ne pilote pas Expo Go — mêmes contraintes natives que
   `react-native-mmkv`/les notifications push, voir `mobile/README.md`).
3. Un compte de test réel dans la base (email/mot de passe) — **aucun
   n'existe dans ce bac à sable** ; les identifiants ci-dessous
   (`test.env.js` ou variables d'environnement Maestro, voir chaque flow)
   sont à renseigner par l'utilisateur.
4. Lancer un flow : `maestro test maestro/login.yaml`.

## Flows

- `login.yaml` — connexion, arrivée sur la liste des écoles.
- `students-browse.yaml` — depuis la liste des écoles, ouvrir une école,
  parcourir la liste Élèves, essayer le filtre sexe (itération 88), ouvrir
  une fiche (vérifie que le bouton photo éditable — Phase 3c, itération 80
  — est bien affiché ; ne va PAS jusqu'au bout du choix caméra/galerie, qui
  sort du périmètre d'un flow automatisé sans fixture image sur
  l'appareil).
- `attendance-entry.yaml` (itération 83) — depuis la liste des écoles, ouvrir
  l'écran Présences, onglet Saisie (visible seulement pour un compte ADMIN/
  GESTION_ELEVES/ENSEIGNANT), choisir la première classe, marquer le premier
  élève Absent avec un motif, enregistrer. Vérifie le toast de succès.
- `grades-entry.yaml` (itération 83) — depuis la liste des écoles, ouvrir
  l'écran Notes, onglet Saisie (visible seulement pour un compte ADMIN/
  GESTION_NOTES/ENSEIGNANT), choisir la première classe puis la première
  matière enseignée dans cette classe, saisir une évaluation (libellé +
  poids) avec une valeur pour le premier élève, enregistrer. Vérifie le
  toast de succès.
- `messaging-attachment.yaml` (itération 85) — depuis la liste des écoles,
  ouvrir la Messagerie, ouvrir la première conversation, envoyer une pièce
  jointe image depuis la galerie via le bouton 📎. Prérequis supplémentaire :
  une conversation existante ET une image dans la galerie de l'appareil/
  l'émulateur.
- `messaging-group.yaml` (itération 111) — depuis la liste des écoles, ouvrir
  la Messagerie, « Nouvelle conversation → », onglet « Groupe », nommer le
  groupe, sélectionner deux contacts, créer, vérifier l'arrivée sur le fil de
  discussion ET la présence du bouton « Membres » (créateur = ADMIN
  automatique). Prérequis supplémentaire : au moins deux autres membres de
  l'école pour le compte de test.
- `messaging-document.yaml` (itération 112) — depuis la liste des écoles,
  ouvrir la Messagerie, ouvrir la première conversation, envoyer une pièce
  jointe DOCUMENT (PDF/bureautique) via le bouton 📎 → « Choisir un
  document ». **Le plus fragile des flows de ce projet** : le sélecteur de
  fichiers natif du système a une mise en page bien moins standardisée qu'un
  sélecteur de galerie photo, l'étape de sélection est donc la plus
  susceptible de nécessiter un ajustement selon l'appareil/le fournisseur de
  stockage réel. Prérequis supplémentaire : une conversation existante ET un
  fichier accessible depuis le sélecteur de documents de l'appareil/
  l'émulateur.
- `school-settings.yaml` (itération 89) — depuis la liste des écoles, lien
  "Paramètres de l'école" (ADMIN uniquement), vérifie que le logo est
  éditable et que les infos de l'école (lecture seule) s'affichent. Ne va
  PAS jusqu'au bout du choix caméra/galerie, même limite que
  students-browse.yaml.
- `tabs-navigation.yaml` (itération 90) — vérifie que les 4 onglets (Accueil/Notes/Présences/Messagerie,
  voir `_layout.tsx`) s'affichent pour un compte Personnel, et navigue entre deux d'entre eux. N'existe QUE
  pour un compte Personnel — un compte Parent/Élève de test ferait échouer la première assertion à raison
  (navigation inchangée, sans barre d'onglets, pour ces deux profils).
- `logout.yaml` — déconnexion depuis la liste des écoles, retour à l'écran
  de connexion.
