# SHIONI — app mobile (React Native / Expo)

Phases 1, 2a, 2b, 2c, 2d et 3a du plan mobile (voir `claude/plan-mobile-react-native.md` dans le Projet
Claude "SCHOOL MANAGEMENT") : setup + authentification + écrans principaux (Phase 1, itération 69), puis
Tableau de bord + Notes/Bulletins (Phase 2a, itération 70), puis migration des formulaires vers
Formik/Yup/toast (itération 71), puis Présences + Emploi du temps (Phase 2b, itération 72), puis
correctif CSRF bloquant login/register (itération 73), puis Messagerie (Phase 2c, itération 74), puis
Élèves/Personnel en consultation (Phase 2d, itération 75 — dernier module de la Phase 2), puis cache
offline en lecture (Phase 3a, itération 76 — premier module de la Phase 3 : offline/notifications/caméra),
puis correctif du typage strict des routes Expo Router (itération 77 — `app.json` déclare enfin
`experiments.typedRoutes`, ce qui permet pour la première fois à `tsc --noEmit` de vérifier réellement les
chemins de navigation dans cet environnement), puis notifications push pour la Messagerie (Phase 3b,
itération 78 — deuxième module de la Phase 3, seul déclencheur entièrement cadré par le plan).
Réutilise l'API Express existante au maximum (voir section 3 du plan) — `backend/` n'a reçu que 8
changements additifs au total, aucune route existante modifiée/déplacée/renommée, ni à l'itération 74, ni
75, ni 76 (les trois n'ont nécessité AUCUN changement backend, tout le périmètre nécessaire existait
déjà — l'offline en lecture, itération 76, est un sujet ENTIÈREMENT client) :

- `backend/src/modules/mobile-auth/` (nouveau module, itération 69) — `/api/v1/mobile/auth/{login,register,refresh,logout}`,
  qui renvoie les tokens en JSON (au lieu d'un cookie httpOnly côté web) en réutilisant `auth.service.ts` tel quel.
- `backend/src/app.ts` (itération 69) — montage de ce module.
- `backend/src/middleware/csrf.ts` (itération 69, corrigé itération 73) — exemption du contrôle CSRF
  pour les requêtes authentifiées par `Authorization: Bearer`, PLUS (itération 73) pour `POST
  .../mobile/auth/{login,register}` spécifiquement — voir la section correctif ci-dessous. Aucun effet
  sur le flux web, qui n'envoie jamais de header `Authorization` et n'appelle jamais ces deux chemins.
- `backend/src/modules/parent-portal/` (itération 72) — nouvel endpoint `GET .../parent/children/:studentId/timetable`,
  réutilisant `timetable.service.ts::listTimetable` tel quel, filtré sur le `groupeId` de l'élève.
- `backend/src/modules/student-portal/` (itération 72) — même ajout, `GET .../student/me/timetable`.
- `backend/src/modules/push-tokens/` (nouveau module, itération 78) — `POST /api/v1/mobile/push-tokens`
  (enregistrement) et `POST .../unregister` (retrait), voir "Phase 3b" plus bas.
- `backend/src/modules/messaging/messaging.service.ts` (itération 78) — `sendMessage` déclenche désormais,
  en plus de la diffusion socket existante, une notification push pour les participants non connectés.

## Démarrer en local

```bash
cd mobile
npm install
cp .env.example .env    # ajuster EXPO_PUBLIC_API_URL selon l'appareil de test, voir src/config.ts
npx expo start
```

Le backend doit tourner en parallèle (`cd ../backend && npm run dev`, avec une base PostgreSQL — voir
`docker-compose.yml` à la racine du dépôt) et `EXPO_PUBLIC_API_URL` doit pointer dessus. **Piège fréquent** :
`localhost` ne fonctionne QUE depuis un simulateur iOS — un émulateur Android a besoin de `10.0.2.2`, un
téléphone physique de l'IP locale de la machine de développement. Voir le commentaire détaillé dans
`src/config.ts` et `.env.example`.

Aucun simulateur/émulateur n'étant disponible dans l'environnement où ce code a été écrit, la vérification
faite ici s'est arrêtée à :
- `npx tsc --noEmit` — 0 erreur (mobile ET backend, à chaque itération). **Depuis l'itération 77**, cette
  commande vérifie enfin RÉELLEMENT les routes typées Expo Router (`Href`) — voir "Correctif itération 77"
  ci-dessous : jusque-là, `.expo/types/router.d.ts` (le fichier généré par Expo Router à partir de
  l'arborescence de `app/`) n'était jamais produit dans cet environnement, et `tsc` se dégradait
  silencieusement en acceptant n'importe quelle chaîne comme chemin de navigation.
- `npx expo export --platform android` (bundle Metro complet, hors connexion à un vrai backend/simulateur) —
  1583 modules (1268 Phase 1, 1279 Phase 2a, 1440 itération 71, 1448 itération 72, 1482 itération 74, 1489
  itération 75, +31 à l'itération 76 — quatre nouvelles dépendances : `react-native-mmkv`,
  `@react-native-community/netinfo`, `@tanstack/query-sync-storage-persister`,
  `@tanstack/react-query-persist-client`, plus leur propre arbre de dépendances ; inchangé à l'itération 77,
  correctif purement en configuration/typage, aucune dépendance ajoutée ; +63 à l'itération 78 — une seule
  nouvelle dépendance, `expo-notifications`, et son arbre), export réussi, aucune
  erreur de bundling/routage/babel. **Limite propre à l'itération 76** : l'export Metro compile le
  graphe JS avec succès mais ne peut PAS vérifier le comportement RUNTIME d'un module natif
  (`react-native-mmkv`) sur un appareil réel — voir la section dédiée ci-dessous.

**Reste à vérifier sur un vrai appareil/simulateur avant de considérer ces phases terminées** : les trois
parcours (personnel, parent, élève) contre un vrai backend avec des données de seed.

## Correctif itération 73 — login/register mobile bloqués par le CSRF web

**Bug rapporté** : toute requête mobile échouait avec « Jeton CSRF invalide ou manquant » — en réalité
**seuls `login` et `register` échouaient**, mais comme rien d'autre n'est atteignable sans passer par
l'un des deux, l'app entière semblait bloquée.

**Cause** : `middleware/csrf.ts` (itération 69) exemptait déjà du contrôle CSRF toute requête portant
`Authorization: Bearer ...`. Mais `POST /api/v1/mobile/auth/login` et `/register` sont *justement* les
deux endpoints qui délivrent le TOUT PREMIER token mobile — appelés alors qu'aucun token n'existe
encore côté client, donc sans en-tête `Authorization` (voir `src/api/client.ts::api.interceptors.
request`), donc jamais couverts par cette exemption. Un client mobile n'a par ailleurs aucun magasin de
cookies participant au double-soumission de cookie (pas de `withCredentials`, pas de relecture d'un
`Set-Cookie`) — ces deux appels échouaient donc SYSTÉMATIQUEMENT en 403, quel que soit l'environnement
(reproduit et confirmé par un harnais de test isolé, sans dépendance à une base de données, avant
correction).

**Correctif** : `csrfProtection` exempte désormais aussi explicitement `req.path === "/v1/mobile/auth/
login"` et `"/v1/mobile/auth/register"`. Exemption sûre — ce module ne lit ni n'agit sur AUCUN cookie de
session (identifiants dans le corps JSON, jamais un ambiant), donc rien qu'une requête forgée cross-site
pourrait détourner. `refresh`/`logout` restent hors de cette liste explicite : un token (même expiré)
reste en SecureStore et continue d'être envoyé en `Authorization: Bearer`, donc déjà couverts par
l'exemption existante — vérifié par le même harnais de test. Le flux CSRF web (cookie + en-tête
`X-CSRF-Token`) reste inchangé et intact, vérifié par régression dans le même harnais.

## Correctif itération 77 — routes typées Expo Router (`app.json` sans `experiments.typedRoutes`)

**Bug rapporté** (erreur TypeScript collée par l'utilisateur) : `router.push({ pathname:
"/(app)/schools/[schoolId]/messaging", ... })` refusé par le compilateur, qui suggérait
`"/(app)/schools/[schoolId]/messaging/index"` à la place.

**Piste initiale, abandonnée après vérification réelle** : les sept endroits du code
utilisant un chemin de dossier nu pour une route à `index.tsx` (`messaging`, `students`,
`personnel`, `children/[studentId]`, `schools`) ont d'abord été modifiés pour ajouter le
suffixe `/index`, par analogie directe avec le message d'erreur collé. Avant de livrer ce
correctif, tentative de le vérifier réellement — jusque-là impossible dans cet
environnement, `.expo/types/router.d.ts` (le fichier que génère Expo Router à partir de
l'arborescence de `app/`, celui qui rend le typage des routes réellement strict) n'ayant
jamais été produit par aucune des commandes de vérification utilisées ici depuis le début
du projet mobile (`tsc --noEmit` seul ne le déclenche pas, ni `expo export`).

**Cause racine, trouvée en creusant cet angle mort** : `app.json` ne déclarait jamais
`"experiments": { "typedRoutes": true }` — absent depuis la toute première itération
mobile. En l'ajoutant puis en forçant un cycle Metro complet (`npx expo start` suivi d'une
requête de bundle complète sur `node_modules/expo-router/entry.bundle`),
`.expo/types/router.d.ts` a enfin pu être généré pour de vrai. Ce fichier généré ne
contient **aucune** occurrence de la chaîne `index` — confirmé à deux reprises (mode
développement et mode production). Lecture du générateur réellement installé
(`node_modules/expo/node_modules/@expo/cli/node_modules/@expo/router-server/build/
typed-routes/generate.js`, ligne 122) : `routeKey = ...contextKey.replace(/\/index$/, '')`
— une route `index.tsx` est TOUJOURS ramenée au chemin de son dossier parent, sans
option pour conserver le suffixe. **Le code original des itérations 74/75 (chemin nu,
sans `/index`) était donc déjà correct** pour la chaîne d'outils réellement installée
dans ce projet — les sept ajouts de `/index` ont été annulés.

**Correctif effectivement livré** : `mobile/app.json` déclare désormais
`"experiments": { "typedRoutes": true }`. C'est ce qui manquait pour que le typage strict
des routes s'active du tout — chez l'utilisateur comme dans cet environnement de
vérification. Avec `.expo/types/router.d.ts` généré et en place, `npx tsc --noEmit` passe
à 0 erreur contre l'union RÉELLE des routes typées, pour la toute première fois : avant ce
correctif, `ExpoRouter.__routes` restait l'interface vide par défaut d'`expo-router`, et le
type `Href` se dégradait silencieusement en `string | HrefObject` — n'importe quelle
chaîne de caractères était acceptée comme chemin de navigation, quel que soit son
exactitude. Autrement dit : cette classe entière de bug était structurellement invisible
à toutes les vérifications menées ici depuis l'itération 69.

**Ce qui reste incertain, honnêtement** : le message d'erreur collé par l'utilisateur
laisse penser que son environnement local générait les routes `index.tsx` avec le suffixe
`/index` conservé — l'inverse exact du comportement observé ici. `expo-router` est déclaré
en `^57.0.22` (non épinglé) dans `package.json`, et le comportement du générateur de types
dépend en réalité d'une dépendance transitive bien plus profonde
(`@expo/cli`/`@expo/router-server`, résolues ici en `57.0.26`/`57.0.10`) que
`package-lock.json` devrait normalement figer à l'identique pour tout le monde. Si
l'erreur persiste malgré ce correctif, la première chose à essayer côté utilisateur est
une réinstallation propre (`rm -rf node_modules && npm ci`, en s'appuyant sur le
`package-lock.json` du dépôt) avant de suspecter une réelle différence de comportement
entre versions d'Expo Router.

## Correctif itération 79 — `react-native-mmkv` réinstallé en v4 malgré l'épinglage

**Bug rapporté** : `'MMKV' only refers to a type, but is being used as a value here.` dans
`storage.ts`, malgré l'épinglage de `react-native-mmkv` à `3.3.3` depuis l'itération 76.
L'utilisateur a confirmé avoir la version `4.3.2` réellement installée.

**Constat** : le code et `package.json` (`^3.3.3`) étaient déjà corrects et cohérents dans
chaque archive livrée — reconfirmé ici (`npm ci` propre → `3.3.3` installée, `tsc --noEmit`
0 erreur). Un simple caret (`^3.3.3`) ne peut pas expliquer à lui seul un saut vers `4.3.2`
sous npm/yarn/pnpm (tous respectent la borne majeure) — la cause précise côté utilisateur
reste non observable depuis cet environnement (pas d'accès à sa machine).

**Correctif, défensif plutôt que suppositions non vérifiables** : `package.json` verrouille
désormais `react-native-mmkv` de deux façons cumulées — la dépendance passe de `^3.3.3` à
`3.3.3` exact, ET un nouveau champ `"overrides": { "react-native-mmkv": "3.3.3" }` force
cette version partout dans l'arbre, y compris si une résolution future (directe ou
transitive) en demandait une autre. `package-lock.json` régénéré en conséquence.

**Vérifié** : `npm install` propre → `3.3.3` installée. `tsc --noEmit` (0 erreur, contre
l'union réelle des routes typées). `EXPO_OFFLINE=1 npx expo export --platform android` —
1583 modules, identique à l'itération 78 (aucune dépendance n'a réellement changé de
version, seul le verrouillage est renforcé), même hash de bundle.

**Recommandation à l'utilisateur** : repartir de zéro — `rm -rf node_modules
package-lock.json`, réinstaller UNIQUEMENT depuis les fichiers de cette nouvelle archive
(ne jamais fusionner avec un `node_modules`/lockfile déjà présent localement), puis
vérifier `cat node_modules/react-native-mmkv/package.json | grep version`.

## Note (2026-09-23) — Erreur runtime « New Architecture not enabled », aucun changement de code

**Bug rapporté** : écran rouge sur émulateur Android, `Failed to create a new
MMKV instance: react-native-mmkv 3.x.x requires TurboModules, but the new
architecture is not enabled!`, sur `src/lib/storage.ts:3` (`new MMKV({ id:
'...`).

Ça confirme d'abord que le correctif ci-dessus a fonctionné : l'app tourne
bien en `react-native-mmkv` v3 chez l'utilisateur. Le nouveau blocage est un
AUTRE prérequis de la v3, pas documenté avant cette note : elle exige la
**New Architecture** (Fabric/TurboModules) active au runtime, pas seulement
déclarée dans `app.json`.

**Diagnostic** : `app.json` contient déjà `"newArchEnabled": true` (depuis
l'itération 76, reconfirmé ici) — ce n'est PAS un bug de configuration
livrée. `newArchEnabled` est un drapeau **natif**, lu uniquement au moment où
le projet natif est généré/compilé (il est écrit dans
`android/gradle.properties`) — jamais au runtime JS. Aucun `android/`/`ios/`
n'est livré dans l'archive (workflow managé/CNG) : ces dossiers sont générés
localement chez l'utilisateur. Cause la plus probable, non vérifiable depuis
cet environnement : un dossier `android/` local généré (ou un APK de dev
client/EAS installé) AVANT que `newArchEnabled: true` ne soit effectif,
jamais régénéré/reconstruit depuis — un simple rechargement Metro/Fast
Refresh ne peut PAS faire apparaître un changement natif.

**Recommandation utilisateur (aucun changement de code, donc aucune nouvelle
archive nécessaire)** :
- Avec `npx expo run:android` en local : désinstaller l'app de l'émulateur,
  puis `npx expo prebuild --clean` (régénère `android/` depuis l'`app.json`
  actuel) suivi de `npx expo run:android` (recompile ET réinstalle un client
  de dev neuf).
- Avec un build de développement EAS : relancer `eas build --profile
  development --platform android` puis réinstaller ce nouvel APK sur
  l'émulateur (après avoir désinstallé l'ancien) — un APK déjà installé ne se
  met jamais à jour tout seul quand `app.json` change.
- Règle générale : tout changement natif dans `app.json` (`newArchEnabled`,
  permissions, icône/splash, package, plugins natifs...) exige une
  régénération/recompilation native complète, jamais juste `r`/Fast Refresh.

## Ce qui est fait

**Phase 1** :
- Authentification mobile de bout en bout : `app/(auth)/login.tsx`, `register.tsx`, tokens persistés en
  `expo-secure-store` (jamais `AsyncStorage`), refresh automatique sur 401 (`src/api/client.ts`).
- Garde d'accès par groupe de routes Expo Router : `app/(app)/_layout.tsx` (redirige vers `/login` si non
  connecté), `app/(auth)/_layout.tsx` (redirige vers l'app si déjà connecté).
- `app/(app)/schools/index.tsx` — liste des écoles (`GET /schools`, route web existante, non modifiée).

**Phase 2a — Tableau de bord + Notes/Bulletins**, un seul écran `dashboard.tsx` qui s'aiguille en trois
rendus selon le statut de l'utilisateur dans l'école (`school.myRoles`/`isGuardian`/`isStudent`, voir
`GET /schools`) :
- **Personnel** : statistiques agrégées (`GET /schools/:schoolId/dashboard`, inchangé) + lien vers
  `notes.tsx` (classement par classe/trimestre, `GET /grades/ranking`) → `bulletin/[studentId].tsx`
  (bulletin détaillé d'un élève, `GET /grades/bulletin/:studentId`). **Lecture seule** : la saisie de
  notes reste hors périmètre de cette phase (voir la note de scope dans `notes.tsx`).
- **Parent** : liste des enfants (`GET /parent/children`) → `children/[studentId].tsx` (bulletin +
  présences + frais d'un enfant, `GET /parent/children/:studentId/summary`).
- **Élève** : son propre bulletin directement (`GET /student/me/summary`), pas d'écran intermédiaire.

`src/components/BulletinView.tsx` est réutilisé par les trois profils staff/parent/élève — une seule
forme de donnée (`Bulletin`), un seul rendu.

**Itération 71 — convention Formik/Yup/toast**, appliquée à `app/(auth)/login.tsx` et `register.tsx`
(les deux seuls formulaires existants à ce stade) :
- `useFormik` + un schéma `Yup.object({...})` par formulaire — plus de `useState` par champ. Les
  erreurs de VALIDATION (champ requis, format email, longueur du mot de passe...) restent affichées
  **inline**, sous le champ concerné (`formik.touched.x && formik.errors.x`).
- `src/lib/toast.ts` (`showSuccessToast`/`showErrorToast`, au-dessus de `react-native-toast-message`)
  — un seul `<Toast />` monté une fois dans `app/_layout.tsx`, jamais par écran. Réservé aux échecs de
  **soumission** (identifiants invalides, serveur injoignable, 4xx...), jamais aux erreurs de
  validation par champ — un toast à chaque frappe serait une mauvaise expérience.
- **Convention pour tout futur formulaire mobile** (saisie de notes en Phase 2c+, etc.) : Formik + Yup
  pour la validation, `showErrorToast`/`showSuccessToast` de `src/lib/toast.ts` pour le résultat de la
  soumission — ne pas réintroduire de `useState` par champ ni de `<Text>` d'erreur statique en haut
  d'écran.

**Phase 2b — Présences + Emploi du temps** (itération 72), lecture seule comme Notes en Phase 2a :
- **Personnel** : `attendance.tsx` (classe/groupe → vue statistiques par élève — présent/absent/retard/
  taux de présence, `GET /attendance/stats`, PAS de sélecteur de plage de dates, voir plus bas) et
  `timetable.tsx` (branche personnel : classe/groupe → `GET /timetable`).
- **Parent** : `children/[studentId]/timetable.tsx` (nouveau, `GET /parent/children/:id/timetable` —
  nouvel endpoint backend, seul ajout nécessaire pour cette phase) ; `children/[studentId]/index.tsx`
  (ex-`children/[studentId].tsx`, déplacé dans un dossier pour accueillir cet écran frère) affiche
  désormais l'historique COMPLET des présences (plus de troncature à 10) via `AttendanceList`.
- **Élève** : `timetable.tsx` (branche élève : direct, `GET /student/me/timetable` — nouvel endpoint
  backend, symétrique à celui du Parent) ; `dashboard.tsx::StudentDashboard` affiche désormais aussi
  l'historique complet de ses présences (même donnée déjà chargée par `useMySummaryQuery`, aucun appel
  réseau supplémentaire).
- `src/components/TimetableList.tsx` et `AttendanceList.tsx` (nouveaux) sont réutilisés par les trois
  profils — même principe que `BulletinView.tsx`.
- **Décision de scope** : la vue Présences du personnel n'a PAS de sélecteur de plage de dates (aucune
  librairie de date picker introduite pour cette phase) — `GET /attendance/stats` est appelée sans
  `dateFrom`/`dateTo`, donc sur l'historique complet de la classe. Un registre jour par jour
  (`GET /attendance`, paginé) existe côté backend mais n'est pas consommé par le mobile pour l'instant.

**Phase 2c — Messagerie** (itération 74), pour les TROIS profils identiquement (RBAC
`requireSchoolMemberOrGuardian` uniquement côté backend, aucune restriction par `SchoolRole` —
contrairement à Notes/Présences réservées au personnel) :
- `messaging/index.tsx` — liste des conversations (`GET .../messaging/conversations`, rafraîchie toutes
  les 30s en complément du temps réel) et, en bascule, liste des contacts (`GET .../messaging/contacts`)
  pour démarrer une conversation PRIVÉE (idempotent côté backend via `Conversation.privateKey` — rappeler
  avec le même contact renvoie la conversation déjà existante).
- `messaging/[conversationId].tsx` — fil de discussion : pagination par curseur (`Message.seq`,
  `useInfiniteQuery`, PAS le contrat page/pageSize partagé du reste du projet) affichée dans une
  `FlatList` inversée ; composition d'un message via **Formik + Yup + toast** (convention itération 71,
  premier formulaire mobile à un seul champ) ; indicateur « X écrit… » et statut en ligne/hors ligne du
  correspondant, tous deux alimentés par `src/lib/messagingSocket.tsx`.
- `src/lib/messagingSocket.tsx` — un contexte React (`MessagingSocketProvider`, monté une fois par
  `messaging/_layout.tsx` pour tout le groupe de routes) miroir de `frontend/src/hooks/
  useMessagingSocket.ts` : mêmes noms d'événements Socket.IO, même répartition des responsabilités (REST
  écrit via `src/api/messaging.ts`, Socket.IO ne fait que diffuser — architecture inchangée depuis
  l'itération 45). Authentification socket par `auth: { token }` (repli déjà prévu côté serveur,
  `authenticateSocket()`, symétrique du repli `Authorization: Bearer` déjà utilisé par le reste de l'API
  mobile) — le mobile n'a pas de cookie de session à faire suivre automatiquement à la connexion socket,
  contrairement au web.
- **Décisions de scope, documentées en commentaire dans le code** : messages **TEXTE uniquement** (pas de
  pièce jointe — `expo-image-picker`/`expo-document-picker` non introduits) ; conversations **PRIVÉES
  uniquement** depuis mobile (pas de création/gestion de groupe cette phase — cohérent avec la
  recommandation du plan de ne pas viser une parité 1:1 avec le web dès la V1). Les routes backend
  couvrent déjà un périmètre plus large (pièces jointes, groupes) ; rien n'est retiré côté serveur, mobile
  n'en consomme simplement qu'un sous-ensemble pour l'instant.

**Phase 2d — Élèves/Personnel en consultation** (itération 75), **dernier module de la Phase 2** :
- `students/index.tsx` + `students/[studentId].tsx` — PERSONNEL uniquement (`requireAnySchoolRole`,
  portée Enseignant appliquée SERVEUR-SIDE via `resolveTeacherScope`, aucune logique de portée dupliquée
  côté mobile). Liste avec recherche texte (anti-rebond 400 ms) + filtre par classe/groupe (même
  sélecteur en pastilles que `attendance.tsx`/`timetable.tsx`), pagination RÉELLE page/pageSize via
  `useInfiniteQuery` — **première utilisation mobile du contrat `{ data, pagination }` partagé**
  (`backend/src/utils/pagination.ts`, jamais `?all=true`, réservé aux sélecteurs internes du web) ;
  Messagerie utilisait déjà `useInfiniteQuery` mais avec un contrat par curseur différent (`Message.seq`).
  Fiche détail en lecture seule (classe, sexe, date/lieu de naissance, âge, contact parent, identifiants
  externes, notes).
- `personnel/index.tsx` + `personnel/[staffId].tsx` — **ADMIN uniquement**, dans les deux sens
  (`personnel.routes.ts` : `requireSchoolRole(ADMIN)` posé avant tout le routeur, lecture comprise — la
  fiche contient `salaireBrut`, aucun rôle `GESTION_PERSONNEL` dédié n'existe). Lien affiché sur le
  Tableau de bord SEULEMENT si `school.myRoles` contient `ADMIN` (même principe défensif que
  `School.isGuardian`/`isStudent` : ne jamais proposer un lien voué à échouer en 403). Filtre "Actifs
  seulement" (`statut=Actif`) plutôt qu'un sélecteur à choix multiples — `statut` reste un champ texte
  libre côté backend, aucun jeu de valeurs fermé à deviner.
- `src/components/AuthenticatedPhoto.tsx` (nouveau, réutilisé par les deux modules) — **piège mobile
  spécifique**, absent côté web : `GET .../photo` n'est jamais servi par `express.static` (toujours une
  route authentifiée) ; le web s'en sort avec un simple `<img src="...">` car son cookie de session suit
  automatiquement la requête, le mobile n'a AUCUN cookie. Solution : `<Image>` de React Native accepte un
  objet `headers` dans sa `source` réseau — `Authorization: Bearer` y est posé explicitement (token lu en
  SecureStore), sans avoir besoin d'écrire le fichier sur disque (`expo-file-system`, réservé à un fichier
  à ouvrir dans une autre app — pas le cas d'une simple vignette affichée à l'écran).
- **Aucun changement backend** — deuxième itération consécutive dans ce cas (après l'itération 74) :
  audit préalable de `students.routes.ts`/`personnel.routes.ts` confirmant que le RBAC nécessaire
  existait déjà intégralement.
- LECTURE SEULE, comme tous les modules mobile jusqu'ici : aucune création/modification/suppression de
  fiche élève ou personnel depuis mobile.

**Phase 3a — Cache offline en lecture** (itération 76), premier module de la Phase 3 :
- `src/lib/storage.ts` (nouveau) — instance `react-native-mmkv` (moteur de stockage local synchrone,
  **PIÈGE MOBILE nouveau à cette itération** : c'est le premier module NATIF ajouté au projet — jusqu'ici
  tout (expo-secure-store, socket.io-client, formik...) restait compatible Expo Go ; MMKV exige un
  "custom dev client" ou un build EAS, comme le prévoyait déjà le plan mobile pour la caméra en Phase 3c
  et pour la distribution en Phase 4). Version épinglée `3.3.3` (pas la 4.x, qui réécrit l'API autour de
  "Nitro Modules") — choix affiné à l'implémentation, le plan ne fixait aucune version précise.
- `src/lib/queryClient.ts` — `createSyncStoragePersister` (contrairement au `@tanstack/
  query-async-storage-persister` évoqué dans le plan, écrit avant que MMKV — synchrone — ne soit
  effectivement choisi comme moteur) branché sur TanStack Query via `PersistQueryClientProvider`
  (`app/_layout.tsx`, remplace `QueryClientProvider`) : hydrate automatiquement le cache au démarrage,
  le persiste au fil des requêtes réussies. `gcTime` porté à 24h (le défaut de 5 min supprimerait les
  données restaurées du cache persisté avant qu'un écran ne les consulte). `onlineManager` de TanStack
  Query branché sur NetInfo (RN n'a pas d'équivalent des événements navigateur `online`/`offline`
  utilisés par défaut) ; `focusManager` branché sur `AppState` (équivalent RN de
  `refetchOnWindowFocus`, plan section 4.5).
- `src/components/OfflineBanner.tsx` (nouveau, monté une fois dans `(app)/_layout.tsx`) — bandeau "Vous
  êtes hors ligne · dernière synchronisation à ..." dès que `NetInfo` signale une absence de réseau,
  visible sur tout écran du groupe `(app)/`. Répond explicitement à la recommandation du plan (section
  4.6) : "un indicateur visuel plutôt qu'une synchronisation silencieuse qui masquerait la fraîcheur
  réelle des données".
- `src/lib/useNetworkStatus.ts` (nouveau, `useIsOffline()`) — partagé par le bandeau ET par
  `messaging/[conversationId].tsx`, seul écran d'ÉCRITURE du mobile pour l'instant : le composeur de
  message se désactive explicitement hors ligne (plan section 4.6 : "bloquer explicitement les écrans de
  saisie... avec un message clair" plutôt qu'une file d'attente de mutations, hors périmètre par
  décision explicite du plan).
- **Correctif** — `authStore.ts::bootstrap` effaçait jusqu'ici la session (tokens + déconnexion) pour
  N'IMPORTE QUEL échec de `GET /auth/me`, y compris une simple absence de réseau au démarrage : ça
  rendait tout le travail de cache offline inutile, puisque l'app ne pouvait pas même atteindre un écran
  déjà mis en cache sans réseau au premier lancement. `src/api/client.ts::isNetworkError` (nouveau)
  distingue maintenant "aucune réponse reçue" d'un échec applicatif réel (401 invalide, compte
  désactivé...) : seul ce dernier cas déconnecte l'utilisateur. Un repli léger du profil (`src/lib/
  storage.ts::getCachedUser`, mis à jour à chaque `fetchMe()`/login/register réussi) permet de rester
  `signedIn` avec le dernier profil connu quand l'app démarre hors ligne.
- **Aucun changement backend** — sujet entièrement côté client.

**Phase 3b — Notifications push** (itération 78), deuxième module de la Phase 3 :
- **Cadrage** : le plan (section 4.1) ne scope entièrement qu'UN déclencheur — un nouveau message de
  Messagerie reçu par un participant non connecté au socket en ce moment. Les déclencheurs "note/absence
  saisie" sont explicitement marqués par le plan comme nécessitant un cadrage utilisateur préalable, non
  fait cette itération — pas un oubli.
- `backend/src/modules/push-tokens/` (nouveau module) + modèle Prisma `PushToken` (additif, unique par
  `token` plutôt que `(userId, token)` : un ré-enregistrement réattribue automatiquement l'appareil au
  compte qui vient de s'y connecter). `POST /api/v1/mobile/push-tokens` (enregistrement) et `POST
  .../unregister` (retrait au logout) — monté sous `/api/v1/mobile/` directement, pas sous
  `/schools/:schoolId/...` : un jeton d'appareil appartient au compte, pas à une école.
- `backend/src/utils/expoPush.ts` (nouveau) — client minimal vers le service Expo Push, `fetch` global
  (Node 18+), aucune dépendance ajoutée. Envoi "fire and forget", jamais attendu par
  `messaging.service.ts::sendMessage` — un échec d'envoi push ne doit jamais ralentir l'envoi du message.
- `src/lib/pushNotifications.ts` (nouveau, mobile) — permission + récupération du jeton Expo Push.
  **PIÈGE MOBILE, nouveau à cette itération** : depuis le SDK 53 d'Expo, la réception de push DISTANTS
  n'est plus prise en charge dans Expo Go (iOS et Android) — dev client/build EAS nécessaire, même limite
  que `react-native-mmkv` (itération 76). **Second piège, propre à ce projet** : aucun `projectId` EAS réel
  n'a jamais été configuré (`eas init` jamais lancé, aucun compte EAS dans cet environnement) — sans lui,
  `getExpoPushTokenAsync` échoue aussi. Les deux cas sont interceptés et traités comme "push indisponible"
  (retourne `null`), jamais comme un crash.
- `app/_layout.tsx` — nouvel effet sur `status === "signedIn"` (login/register/bootstrap réussi) :
  enregistre le jeton, best-effort intégral. `authStore.ts::logout` désenregistre explicitement le jeton
  de cet appareil avant d'effacer la session (`storage.ts` garde le dernier jeton enregistré, même patron
  que `getCachedUser`/`clearCachedUser` de l'itération 76).
- **Limite de vérification** : aucune notification n'a pu être reçue sur un appareil réel dans cet
  environnement (voir les deux pièges ci-dessus) — seules la compilation TypeScript et la résolution du
  graphe Metro ont pu être vérifiées.

**Phase 3c — Capture photo (Élèves/Personnel)** (itération 80), dernier module de la Phase 3 :
- **Cadrage** : le plan (section 4.3) esquissait un `PhotoCaptureDialog.tsx` bâti sur `expo-camera`
  (machine à 3 états view/camera/review, miroir de `PhotoManagerDialog.tsx` web). Choix différent, affiné à
  l'implémentation : `expo-image-picker` (déjà dans les dépendances recommandées du plan) couvre
  `launchCameraAsync`/`launchImageLibraryAsync` via les vues natives de l'OS — recadrage/validation déjà
  fourni (`allowsEditing: true`), pas de composant caméra custom à construire. Moins de surface native
  ajoutée, choix d'autant plus justifié après les difficultés de build natif de l'itération précédente.
- **Périmètre** : upload/suppression de la photo pour Élèves ET Personnel — SEULE exception à la lecture
  seule de ces deux modules (Phase 2d, itération 75), le reste du CRUD élève/personnel restant réservé au
  web. Logo d'école (même mécanisme backend, itération 64) volontairement hors périmètre mobile — action de
  configuration ponctuelle, plus naturelle depuis un poste web.
- `src/lib/photoPicker.ts` (nouveau) — action combinée « Prendre une photo »/« Choisir depuis la
  galerie »/« Supprimer la photo », permission demandée juste avant le lancement correspondant, recadrage
  carré + `quality: 0.7` (reste sous `PHOTOS_MAX_FILE_MB`, 5 Mo par défaut).
- `src/components/EditablePhoto.tsx` (nouveau) — variante éditable d'`AuthenticatedPhoto` (Phase 2d,
  INCHANGÉE partout ailleurs en lecture seule).
- `src/api/students.ts`/`src/api/personnel.ts` — `useUpload*PhotoMutation`/`useRemove*PhotoMutation`, mêmes
  endpoints déjà consommés en lecture (`POST`/`DELETE .../photo`, itération 64) — **aucun changement
  backend**. Réponse posée directement en cache (`setQueryData`), pas d'invalidation.
- `students/[studentId].tsx` — photo éditable SEULEMENT si `school.myRoles` contient ADMIN/GESTION_ELEVES
  (mêmes rôles que `canManage` backend) ; `personnel/[staffId].tsx` — toujours éditable (module déjà
  ADMIN-only dans son ensemble). `photoNonce` local en paramètre d'URL : cache-busting après
  upload/suppression, même réflexe que le web (itération 68).
- **Vérifié** : `tsc --noEmit` 0 erreur ; `expo export --platform android` — 1641 modules (1583 à
  l'itération 79, +58 pour `expo-image-picker`), export réussi.
- Fin de la Phase 3 du plan mobile — reste la Phase 4 (tests e2e, EAS Build, soumission stores).

**Phase 4 — Tests unitaires + scaffolding e2e** (itération 81), début de la Phase 4 (reste : build EAS réel,
soumission stores, hors périmètre — voir plus bas) :
- **Tests unitaires** — `jest-expo` + `@testing-library/react-native` 14 (React 19 : `render()` y est devenue
  **asynchrone**, piège de version vérifié plutôt que supposé). `src/lib/pagination.ts` (nouveau) extrait,
  SANS changement de comportement, la logique `getNextPageParam` jusqu'ici dupliquée à l'identique dans
  `students.ts`/`personnel.ts` — DRY et, surtout, testable isolément. 5 suites ajoutées (pagination,
  `extractErrorMessage`, `isNetworkError`, `AuthenticatedPhoto`/`initials()`, `presentPhotoSourceOptions`).
  **Vérifié** : `npm test` — 19 tests, tous PASS ; `tsc --noEmit` 0 erreur (avec `tsconfig.json::types: ["jest"]`,
  sans quoi `describe`/`it`/`expect` ne sont pas reconnus) ; `expo export` toujours propre.
- **Scaffolding e2e (Maestro)** — `mobile/maestro/` (nouveau), 3 flows (`login`, `students-browse`,
  `logout`). Maestro plutôt que Detox (moins de setup natif, choix justifié après les difficultés de build
  de l'itération 80). **NON exécutés dans cet environnement** — aucun émulateur/simulateur disponible ici ;
  écrits contre le texte réel des écrans (vérifié en lisant le code), à rejouer une première fois par
  l'utilisateur avant de leur faire confiance — voir `mobile/maestro/README.md`.
- **Hors périmètre, documenté** : build EAS réel et soumission aux stores (`eas init` jamais lancé, aucun
  compte EAS/Apple/Google dans ce bac à sable) ; intégration CI (aucun workflow GitHub Actions n'existe
  encore pour aucune partie du projet — backend/frontend/mobile — introduire un premier pipeline dépasserait
  le périmètre mobile de cette itération).

**Notifications push — deux compléments** (itération 82), tous deux purement techniques (pas de cadrage
utilisateur requis, contrairement aux déclencheurs notes/absences) :
- **Suivi des reçus de livraison + purge des jetons invalides** — `backend/src/utils/expoPush.ts` interroge
  désormais le second endpoint Expo (`/getReceipts`, différé via un `setTimeout` DÉLIBÉRÉMENT minimal — pas
  une vraie file de tâches, ne survit pas à un redémarrage serveur) et purge tout jeton `DeviceNotRegistered`
  (`push-tokens.service.ts::removeTokens`, nouveau).
- **Navigation directe au tap sur une notification** — `schoolId` ajouté au payload push (`messaging.
  service.ts`, `conversationId` seul ne suffisait pas à construire la route) ; `pushNotifications.ts::
  extractMessagingNotificationData` (nouveau, extraction défensive, jamais un cast — la Messagerie est le
  SEUL déclencheur existant mais un futur déclencheur notes/absences enverrait probablement une autre
  forme) ; `app/_layout.tsx` couvre les deux cas documentés par `expo-notifications` :
  `addNotificationResponseReceivedListener` (tap app déjà lancée) ET `getLastNotificationResponseAsync`
  (tap qui relance l'app, cold start — sans lui ce cas serait silencieusement perdu).
- **Vérifié** : `tsc --noEmit` (backend ET mobile) 0 erreur ; `npm test` (mobile) — 6 suites, 23 tests, tous
  PASS ; `expo export` toujours propre. **Non vérifié** : comportement runtime réel sur un appareil (aucun
  disponible ici, même limite que pour tout push depuis l'itération 78).

**Saisie de présence** (itération 83), Phase 2b — premier écran d'écriture métier du mobile (hors photo,
itération 80) :
- `attendance.tsx` réécrit avec deux onglets Saisie/Récapitulatif (sélecteur de classe partagé) ; onglet
  Saisie affiché seulement si `school.myRoles` contient ADMIN/GESTION_ELEVES/ENSEIGNANT (confort d'affichage
  client, RBAC réel restreint aux propres classes d'un ENSEIGNANT côté serveur via `resolveTeacherScope`,
  aucun changement backend). Navigation par jour (± 1 jour, pas de sélecteur de date — aucune librairie
  introduite) ; statut par élève (Présent/Retard/Absent) préchargé depuis l'existant, motif + case
  "Justifiée" hors "Présent". Périmètre volontairement réduit par rapport au web : pas de champ "heure"
  (suivi par période, cas secondaire).
- `useAttendanceQuery`/`useBulkSetAttendanceMutation` (`api/attendance.ts`) et `useClassRosterQuery`
  (`api/students.ts`, nouveau) — tous deux en `all: true` (registre d'UNE classe pour UN jour/roster d'UNE
  classe, par nature bornés — même échappatoire que le web, jamais utilisée pour une liste potentiellement
  longue ailleurs sur mobile).
- Écran bloqué explicitement hors ligne (`useIsOffline`, introduit à l'itération 76 pour la Messagerie,
  premier réemploi) — conforme au choix déjà tranché par le plan mobile section 4.6.
- `maestro/attendance-entry.yaml` (nouveau) — non exécuté ici, même limite que les flows précédents.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 23 tests, tous PASS (inchangé, pas de
  nouveau test unitaire pour cet écran) ; `expo export` toujours propre. **Non vérifié** : comportement
  runtime réel (saisie, RBAC serveur sur un compte Enseignant restreint) sur un appareil ; exécution réelle
  du flow Maestro.

**Saisie de notes** (itération 84), Phase 2a — suite naturelle de la Présence, plus fine (classe **ET**
matière, RBAC par couple via `resolveTeacherScope`) :
- `api/me.ts` (nouveau) — `useMyTeachingScopeQuery`, premier usage mobile de `GET .../me/teaching-scope`
  (route web existante depuis l'itération 29). Nécessaire pour filtrer le sélecteur de matière à ce que le
  compte a réellement le droit d'enseigner — pas qu'un confort d'affichage, sans quoi l'enregistrement
  échouerait systématiquement en 403 pour un Enseignant restreint.
- `api/subjects.ts` (nouveau) — `useSubjectsQuery`, lecture seule, croisée avec les coefficients pour ne
  proposer que les matières réellement enseignées dans la classe choisie.
- `notes.tsx` réécrit avec deux onglets Saisie/Classement (Classement inchangé depuis l'itération 70) ; onglet
  Saisie visible seulement pour ADMIN/GESTION_NOTES/ENSEIGNANT. Périmètre volontairement réduit par rapport
  au web : UNE évaluation à la fois (libellé + poids + une valeur par élève), pas une matrice de toutes les
  évaluations — reflète exactement le contrat de l'endpoint `bulk`. Chips des libellés déjà saisis pour
  reprendre une évaluation existante sans risquer un doublon par faute de frappe.
- `useClassRosterQuery` (déjà introduit à l'itération 83) réemployé tel quel — zéro duplication.
- Écran bloqué explicitement hors ligne (même mécanisme que Présences).
- `maestro/grades-entry.yaml` (nouveau) — non exécuté ici, même limite que les flows précédents.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 23 tests, tous PASS ; `expo export` toujours
  propre. **Non vérifié** : comportement runtime réel (saisie, RBAC serveur par couple classe/matière) sur un
  appareil ; exécution réelle du flow Maestro.

**Pièces jointes image en Messagerie** (itération 85) — lève une partie du scope réduit de l'itération 74,
devenu raisonnable maintenant qu'`expo-image-picker` est déjà une dépendance du projet (itération 80) :
- `photoPicker.ts::pickMessageAttachment` (nouveau) — pas de recadrage carré forcé (sans objet pour un
  envoi tel quel), `quality: 0.6`. `presentPhotoSourceOptions` réemployée telle quelle pour le choix
  caméra/galerie.
- `api/messaging.ts::useSendMessageWithAttachmentMutation`/`messageAttachmentUrl` — endpoint WEB existant
  réutilisé tel quel, **aucun changement backend**.
- `components/AttachmentImage.tsx` (nouveau) — affichage inline, même mécanisme `Authorization: Bearer`
  explicite qu'`AuthenticatedPhoto.tsx` (itération 75).
- `messaging/[conversationId].tsx` — bouton 📎 à côté du composeur ; une pièce jointe `image/*` s'affiche
  inline, tout autre type (PDF/bureautique envoyé depuis le web) s'affiche en étiquette nom de fichier NON
  ouvrable depuis mobile (`expo-document-picker` non introduit — scope volontairement limité aux images).
- `maestro/messaging-attachment.yaml` (nouveau) — non exécuté ici, même limite que les flows précédents.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 23 tests, tous PASS (inchangé —
  `pickMessageAttachment`, comme `pickPhotoFrom`, n'est pas unit-testé) ; `expo export` toujours propre.
  **Non vérifié** : comportement runtime réel (envoi, affichage, permissions caméra/galerie) sur un appareil ;
  exécution réelle du flow Maestro.

**Plage de dates pour le récapitulatif de présences** (itération 86), dernier point purement technique resté
ouvert sur ce module :
- `api/attendance.ts::useAttendanceStatsQuery` accepte désormais `dateFrom`/`dateTo` optionnels (endpoint
  backend déjà prêt à les recevoir depuis toujours — **aucun changement backend**). Sans eux : comportement
  inchangé (historique complet).
- `attendance.tsx::AttendanceRecap` — 4 raccourcis (Tout/7/30/90 derniers jours, "Tout" par défaut), pas un
  vrai calendrier — même simplification assumée que la Saisie (itération 83, aucune librairie de date
  picker introduite).
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 23 tests, tous PASS (inchangé, simple passage
  de paramètres) ; `expo export` toujours propre. **Non vérifié** : comportement runtime réel sur un appareil.

**Déclencheur push pour les absences** (itération 87), dernier item de cadrage en attente depuis
l'itération 78, délégué par l'utilisateur à cette itération (« je vous laisse le choix de ce cadrage ») —
voir le README racine pour le détail complet des décisions de scope :
- Backend (`attendance.service.ts::notifyAbsenceGuardians`, nouveau) — se déclenche uniquement sur un statut
  ABSENT explicitement présent dans la requête (jamais sur la valeur déjà en base), branché sur les 3 points
  d'écriture (création/modification unitaires + saisie groupée). Résout les `StudentGuardian`, réutilise
  `sendExpoPushNotifications` (itération 82) telle quelle. Best-effort, non bloquant, même patron que
  `notifyOfflineParticipants` (Messagerie, itération 78).
- `pushNotifications.ts::extractAbsenceNotificationData` (nouveau) — pendant de
  `extractMessagingNotificationData`, discriminé par `kind: "absence"` dans le payload ; les deux extractions
  sont mutuellement exclusives par construction (testé).
- `app/_layout.tsx` — le handler de tap sur notification tente les deux extractions, navigue vers
  `children/[studentId]` (écran Parent existant) pour une notification d'absence.
- **Vérifié** : `tsc --noEmit` (backend ET mobile) 0 erreur ; `npm test` — 6 suites, **27 tests** (4 nouveaux),
  tous PASS ; `expo export` toujours propre. **Non vérifié** : livraison réelle d'un push à un téléphone
  (aucun projet EAS configuré ici, limite déjà documentée depuis l'itération 78) ; navigation réelle au tap.
  Aucun flow Maestro ajouté pour ce déclencheur — pas de geste UI réaliste à scripter pour "recevoir puis
  taper une notification push distante".

**Filtre sexe sur la liste des élèves** (itération 88), parité avec `StudentsPage.tsx` (web) — point
purement technique, aucun cadrage requis :
- `api/students.ts::StudentFilters` — ajout de `sex?: "M" | "F"`, transmis à l'endpoint déjà existant
  (**aucun changement backend**, `students.schema.ts` l'accepte depuis toujours).
- `students/index.tsx` — 3 pills (Tous/Garçons/Filles, "Tous" par défaut), même style que les pills de
  classe déjà présentes sur cet écran.
- `maestro/students-browse.yaml` — étendu pour essayer le filtre.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS (inchangé, simple
  passage de paramètre) ; `expo export` toujours propre. **Non vérifié** : comportement runtime réel sur
  un appareil.

**Logo d'école éditable** (itération 89), dernier upload photo/fichier resté hors périmètre mobile —
élèves/personnel avaient déjà leur photo éditable depuis l'itération 80 :
- `api/schools.ts` — `schoolLogoUrl`/`useUploadSchoolLogoMutation`/`useRemoveSchoolLogoMutation`, même
  patron exact que `students.ts` pour la photo élève (**aucun changement backend**, routes ADMIN existantes
  depuis l'itération 64 côté web).
- Nouvel écran `settings.tsx` — entièrement ADMIN-only, réutilise `EditablePhoto` pour le logo ; le reste
  des infos de l'école reste en lecture seule (même principe que Élèves/Personnel : la photo est la seule
  exception à l'écriture). Lien "Paramètres de l'école →" ajouté au tableau de bord Personnel (ADMIN
  uniquement).
- `maestro/school-settings.yaml` (nouveau).
- **Point technique notable** : premier NOUVEAU fichier de route ajouté depuis le correctif itération 77
  (`experiments.typedRoutes`) — a révélé que `.expo/types/router.d.ts` ne se régénère ni avec `tsc --noEmit`
  seul ni avec `expo export`, seulement via un cycle `expo start` complet (serveur + une requête de bundle
  réelle sur `entry.bundle`). Sans conséquence pour les itérations précédentes (aucune n'ajoutait de nouveau
  fichier de route), mais À REFAIRE pour toute future itération qui ajouterait un nouvel écran — sinon
  `tsc --noEmit` échoue sur le nouveau `router.push(...)` avec un typage périmé, pas une vraie erreur de
  code.
- **Vérifié** : `tsc --noEmit` 0 erreur (après régénération de `router.d.ts` comme ci-dessus) ; `npm test` —
  6 suites, 27 tests, tous PASS (inchangé) ; `expo export` toujours propre. **Non vérifié** : comportement
  runtime réel (upload/suppression du logo) sur un appareil.

**Adoption de NativeWind** (itération 90) — choix du design system, délégué par l'utilisateur à
l'itération 87 puis confirmé explicitement à cette itération. **NativeWind retenu** (pas Tamagui ni RN
Paper) : même mental model utilitaire que le choix déjà fait côté web (Tailwind CSS v4 + shadcn/ui), sans
introduire un deuxième système radicalement différent. `tailwindcss@3.4.19` (v3, pas v4 comme le web — deux
packages/toolchains indépendants, NativeWind v4.x s'appuyant sur le format config JS classique de
Tailwind v3).
- Dépendances **toutes épinglées en version exacte** (même précaution que le correctif itération 79) :
  `nativewind@4.2.7`, `tailwindcss@3.4.19`, `babel-preset-expo@57.0.12`, `react-native-reanimated@4.5.1`,
  `react-native-worklets@0.10.1` (ces deux dernières lues dans `expo/bundledNativeModules.json`, `npx expo
  install` étant indisponible ici — hôte de compatibilité bloqué par le proxy réseau du bac à sable).
- Nouveaux fichiers : `tailwind.config.js`, `global.css`, `babel.config.js`, `metro.config.js`,
  `nativewind-env.d.ts` (aucun n'existait — Expo utilisait sa config Babel/Metro par défaut implicite).
  `app/_layout.tsx` : un seul ajout, `import "../global.css"` en tout premier import.
- **Deux obstacles résolus en creusant, pas contournés** : (1) `babel-preset-expo` introuvable à l'export
  dès qu'un `babel.config.js` explicite existe au niveau du projet (il n'était niché que dans
  `expo/node_modules/`, jamais un souci avant car Expo le résolvait en interne) — ajouté en devDependency
  directe. (2) NativeWind inclut INCONDITIONNELLEMENT le plugin Babel `react-native-reanimated/plugin` (via
  `react-native-css-interop/babel.js`) dès que `nativewind/babel` est utilisé, même sans aucune animation
  Reanimated dans l'app — `react-native-reanimated`/`react-native-worklets` installés en conséquence.
  `app.json` avait déjà `newArchEnabled: true` depuis l'itération 76 (prérequis natif de Reanimated 4) —
  aucun changement supplémentaire nécessaire.
- **Premier écran migré, comme référence** : `settings.tsx` (le plus récent/petit) — `StyleSheet.create` →
  `className`, valeur par valeur EXACTEMENT identique à l'ancien style (syntaxe crochets `text-[13px]`,
  `bg-[#f5f7fa]`...) plutôt qu'une approximation à l'échelle Tailwind, pour ne courir aucun risque de dérive
  visuelle non vérifiable ici.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS (inchangé, écran
  purement présentationnel) ; `expo export` — export réussi, 1981 modules contre 1590 avant (+~1,1 Mo de
  bundle, attendu). **Non vérifié, honnêtement** : le rendu visuel RÉEL sur un appareil — la compilation/le
  bundling réussis prouvent que le pipeline babel/metro fonctionne de bout en bout, pas que le résultat a
  exactement le même pixel qu'avant.
- **Ce qui reste, délibérément** : migration des ~20 autres écrans/composants mobile — pas faite ici, par
  choix (un écran de référence d'abord, le reste itération par itération, jamais un big-bang non
  vérifiable visuellement).

**Restructuration en Tabs au niveau école** (itération 91) — deuxième et dernier item de cadrage délégué à
l'itération 87. Exactement 4 onglets, la portée documentée depuis l'origine (commentaire d'en-tête de
`[schoolId]/_layout.tsx`, Phase 1) : **Tableau de bord / Notes / Présences / Messagerie**.
- **PAS un Tabs universel** : Notes/Présences sont des écrans personnel uniquement (aucun accès Parent/
  Élève depuis toujours) — `_layout.tsx` charge `school.myRoles` et choisit `<Tabs>` pour le Personnel,
  `<Stack>` STRICTEMENT INCHANGÉ pour Parent/Élève (zéro régression sur ces deux profils).
- 6 écrans (Emploi du temps, Paramètres, Élèves, Personnel, Bulletin, Enfants) déclarés `href: null` —
  cachés de la barre, atteignables EXACTEMENT comme avant (mêmes liens depuis le Tableau de bord). Patron
  officiellement documenté par Expo Router (onglets visibles + route "modal" cachée).
- `messaging` : `headerShown: false` sur son `Tabs.Screen` (son propre `_layout.tsx`/Stack imbriqué gère
  déjà ses en-têtes) ; `dashboard.tsx`/`notes.tsx`/`attendance.tsx` **aucun changement** (leur
  `<Stack.Screen options={{title}}/>` interne fonctionne tel quel sous Tabs, mécanisme générique Expo
  Router indépendant du type de navigateur parent).
- Icônes : emoji/texte, aucune dépendance supplémentaire (`@expo/vector-icons` absente du projet).
- `maestro/tabs-navigation.yaml` (nouveau).
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS (inchangé) ; `expo
  export` — export réussi (le test le plus significatif : un nom de route invalide dans `Tabs.Screen`
  aurait fait échouer le bundling Expo Router lui-même). **Non vérifié, honnêtement — le point le plus
  incertain de cette itération** : le comportement EXACT du bouton retour pour les écrans cachés atteints
  depuis un onglet différent du leur (Bulletin depuis Notes, Paramètres/Élèves/Personnel/Emploi du temps
  depuis le Tableau de bord). Le patron utilisé est celui documenté par Expo Router, mais aucun
  appareil/émulateur disponible ici pour le confirmer — un test manuel réel est fortement recommandé avant
  mise en production.

**Deuxième écran migré vers NativeWind** (itération 92) — `schools/index.tsx` (liste "Mes écoles"), poursuite
de la migration itération par itération déjà planifiée à l'itération 90 (aucun cadrage en attente après
l'itération 91).
- Choisi car premier écran vu après connexion (haute visibilité) et le plus simple des ~19 restants (une
  liste + un en-tête, aucun état conditionnel autre que chargement/erreur/vide).
- Même convention qu'à l'itération 90 : syntaxe crochets pour les valeurs hors échelle Tailwind standard,
  classes utilitaires standard seulement quand elles correspondent EXACTEMENT (`p-4` = 16px, `text-base` =
  16px). Vérifié avant d'écrire le fichier (pas supposé) : `FlatList` supporte nativement `className`/
  `contentContainerClassName` via le `remapProps` de `react-native-css-interop`.
- Aucun texte ni comportement changé — `maestro/login.yaml` (qui s'arrête sur cet écran) reste valide sans
  modification.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS (inchangé) ; `expo
  export` — export réussi, 1981 modules (identique aux itérations 90/91, aucune dépendance ajoutée).
  **Non vérifié, honnêtement** : le rendu visuel RÉEL sur un appareil, même limite qu'à l'itération 90.
- **Ce qui reste** : ~18 écrans mobile toujours sur `StyleSheet.create`, migration future itération par
  itération.

**Troisième écran migré vers NativeWind** (itération 93) — `(auth)/login.tsx`, poursuite de la migration
itération par itération (aucun cadrage en attente).
- Choisi car tout premier écran vu par un utilisateur non connecté (haute visibilité), formulaire simple.
- Même convention qu'aux itérations 90/92. Point vérifié avant d'écrire le fichier (pas supposé, en lisant
  `node_modules/expo-router/build/link/BaseExpoRouterLink.js`) : le `<Link>` d'Expo Router rend en interne
  un `<Text>` React Native natif et lui transmet `className` comme n'importe quel prop non consommé — donc
  `className` fonctionne sur `<Link>` exactement comme sur un `<Text>`.
- Aucun texte ni comportement changé — `maestro/login.yaml` reste valide sans modification.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90/91/92, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil, même limite qu'aux itérations précédentes.
- **Ce qui reste** : ~17 écrans mobile toujours sur `StyleSheet.create` (dont `register.tsx`, très proche de
  `login.tsx`, bon candidat suivant), migration future itération par itération.

**Quatrième écran migré vers NativeWind** (itération 94) — `(auth)/register.tsx`, candidat identifié à la
clôture de l'itération 93 (styles quasi identiques à `login.tsx`).
- Mêmes classes que `login.tsx` pour les styles partagés (container/input/fieldError/button/buttonText/
  link), seul le titre diffère (`text-[22px]` contre `text-[28px]` + sous-titre séparé sur `login.tsx`).
- Aucun texte ni comportement changé ; aucun flow Maestro ne couvre cet écran (vérifié avant de commencer).
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90/91/92/93, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil, même limite qu'aux itérations précédentes.
- **Ce qui reste** : ~16 écrans mobile toujours sur `StyleSheet.create` — les deux écrans d'authentification
  sont désormais tous deux migrés ; candidats suivants probables : `timetable.tsx` ou `personnel/index.tsx`,
  non évalués en détail ici.

**Cinquième écran migré vers NativeWind** (itération 95) — `personnel/index.tsx`, retenu plutôt que
`timetable.tsx` (plus simple, non référencé par aucun flow Maestro — vérifié avant de commencer).
- **Point de vigilance traité** : les styles conditionnels d'origine (`[styleA, cond && styleB]`, où `styleB`
  gagne propriété par propriété) ne se traduisent PAS automatiquement par l'empilement de deux classes
  Tailwind arbitraires dans un même `className` — l'ordre de la cascade CSS générée dépend de l'ordre de
  génération des règles par Tailwind, pas de l'ordre d'apparition dans `className`. Chaque style conditionnel
  (badge de statut, case à cocher) choisit donc explicitement UNE SEULE classe par branche via un template
  littéral.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90 à 94, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil, en particulier le badge de statut et la case à cocher
  conditionnels.
- **Ce qui reste** : ~15 écrans mobile toujours sur `StyleSheet.create` ; `timetable.tsx` reste un bon
  candidat suivant.

**Sixième écran migré vers NativeWind** (itération 96) — `timetable.tsx` (les trois fonctions du fichier :
`TimetableScreen`/`StaffTimetable`/`StudentTimetable`), non référencé par aucun flow Maestro.
- Même point de vigilance qu'à l'itération 95 pour la pastille de classe sélectionnée : une seule classe de
  fond/texte choisie explicitement par branche, jamais deux classes empilées.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90 à 95, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil, en particulier la pastille de classe sélectionnée.
- **Ce qui reste** : ~14 écrans mobile toujours sur `StyleSheet.create`.

**Septième écran migré vers NativeWind** (itération 97) — `children/[studentId]/timetable.tsx` (emploi du
temps d'un enfant, pour son parent), le plus petit écran restant avec du style réel (les fichiers plus courts
— `index.tsx`, `(auth)/_layout.tsx`, `messaging/_layout.tsx`, `(app)/_layout.tsx` — n'ont aucun `StyleSheet`
à migrer, vérifié via `wc -l` + lecture avant de commencer). Écran trivial (3 styles, aucune valeur
conditionnelle) ; non référencé par aucun flow Maestro.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90 à 96, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil, même limite qu'aux itérations précédentes.
- **Ce qui reste** : ~13 écrans mobile toujours sur `StyleSheet.create` — `bulletin/[studentId].tsx` a un
  style quasi identique (même structure à 3 styles), bon candidat suivant.

**Huitième écran migré vers NativeWind** (itération 98) — `bulletin/[studentId].tsx`, même conversion exacte
que l'itération 97 (structure à 3 styles identique). Écran trivial, aucune valeur conditionnelle ; non
référencé par aucun flow Maestro.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90 à 97, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil, même limite qu'aux itérations précédentes.
- **Ce qui reste** : ~12 écrans mobile toujours sur `StyleSheet.create`.

**Neuvième écran migré vers NativeWind** (itération 99) — `personnel/[staffId].tsx` (fiche personnel en
lecture seule, ADMIN uniquement), patron déjà familier : carte/champ identique à `settings.tsx`, badge de
statut conditionnel identique à `personnel/index.tsx`. Non référencé par aucun flow Maestro.
- Même point de vigilance qu'aux itérations 95/96/98 pour le badge de statut conditionnel : une seule classe
  par branche.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90 à 98, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil, en particulier le badge de statut conditionnel.
- **Ce qui reste** : ~11 écrans mobile toujours sur `StyleSheet.create`.

**Dixième écran migré vers NativeWind** (itération 100) — `children/[studentId]/index.tsx` (résumé d'un
enfant pour son parent — bulletin, frais, présences). Non référencé par aucun flow Maestro.
- **Cas nouveau** : le statut de frais a TROIS valeurs (SOLDE/PARTIEL/impayé), pas deux comme les badges
  précédents — `feeStatusStyle(status)` devient `feeStatusClassName(status)`, une fonction qui retourne la
  classe `className` COMPLÈTE de la branche plutôt qu'une classe partielle à empiler.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90 à 99, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil, en particulier les trois couleurs de statut de frais.
- **Ce qui reste, décompte exact vérifié par grep** (`StyleSheet.create(` sur tous les fichiers de `app/`,
  pas une estimation) : **7 écrans** — `notes.tsx`, `attendance.tsx`, `messaging/[conversationId].tsx`,
  `messaging/index.tsx`, `students/[studentId].tsx`, `students/index.tsx`, `dashboard.tsx`. Les estimations
  "~X écrans restants" des itérations précédentes comptaient à tort tous les `.tsx`, y compris les
  `_layout.tsx`/`index.tsx` racine sans aucun style — ce décompte-ci est le premier vérifié précisément.

**Onzième écran migré vers NativeWind** (itération 101) — `students/[studentId].tsx` (fiche élève en lecture
seule), même patron carte/champ que `personnel/[staffId].tsx`/`settings.tsx`, aucune valeur conditionnelle.
- Couvert par `students-browse.yaml` (assertion sur "📷", rendu par `EditablePhoto` — composant non touché,
  aucun texte changé) — flow relu avant de commencer. Corrigé au passage un commentaire de ce flow devenu
  inexact depuis l'itération 91 (mentionnait « Tabs non introduits ») — Élèves y est en fait déclaré
  `href: null`, atteint depuis le Tableau de bord comme avant.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90 à 100, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil.
- **Ce qui reste** : 6 écrans — `notes.tsx`, `attendance.tsx`, `messaging/[conversationId].tsx`,
  `messaging/index.tsx`, `students/index.tsx`, `dashboard.tsx`.

**Douzième écran migré vers NativeWind** (itération 102) — `messaging/index.tsx`, le plus petit des 6 écrans
restants, aucune valeur conditionnelle (les deux vues — conversations/contacts — partagent déjà les mêmes
classes, différence de contenu pas de style).
- Couvert par `messaging-attachment.yaml` (Maestro), relu avant de commencer : tape par position (`index:
  0`), jamais sur un texte propre à cet écran, donc insensible à ce changement.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90 à 101, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil.
- **Ce qui reste** : 5 écrans — `notes.tsx`, `attendance.tsx`, `messaging/[conversationId].tsx`,
  `students/index.tsx`, `dashboard.tsx`.

**Treizième écran migré vers NativeWind** (itération 103) — `students/index.tsx`, le plus petit des 5 écrans
restants. Deux pastilles conditionnelles (filtre classe, filtre sexe) reprennent le patron déjà établi à
l'itération 96.
- Couvert de près par `students-browse.yaml` (Maestro) : placeholder "Rechercher un élève…", taps sur
  "Filles"/"Tous" — relu avant de commencer, aucun texte changé.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90 à 102, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil, en particulier les deux pastilles conditionnelles.
- **Ce qui reste** : 4 écrans, les plus gros du lot (285 à 521 lignes) — `notes.tsx`, `attendance.tsx`,
  `messaging/[conversationId].tsx`, `dashboard.tsx`.

**Quatorzième écran migré vers NativeWind** (itération 104) — `dashboard.tsx`, le plus référencé par Maestro
rencontré dans cette série (6 flows : `tabs-navigation.yaml`, `attendance-entry.yaml`, `students-browse.yaml`,
`messaging-attachment.yaml`, `school-settings.yaml`, `grades-entry.yaml`). Aucun patron de classe
conditionnelle nécessaire — les gardes `isAdmin &&` déterminent si un élément est rendu, pas son style.
- Les six flows Maestro concernés ont été relus avant de commencer : chacun assert/tape sur un libellé exact,
  aucun texte modifié par cette migration.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90 à 103, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil, en particulier la grille de `StatTile`.
- **Ce qui reste** : 3 écrans, les plus gros du lot — `notes.tsx` (488 lignes), `attendance.tsx` (521
  lignes), `messaging/[conversationId].tsx` (373 lignes).

**Quinzième écran migré vers NativeWind** (itération 105) — `messaging/[conversationId].tsx`, le plus petit
des 3 écrans restants. Plus grand nombre de styles conditionnels rencontré dans cette série (bulle
mine/theirs, pastille en ligne/hors ligne, pièce jointe mine/theirs, boutons désactivés) — patron de
l'itération 95 appliqué systématiquement. `transform: [{ scaleY: -1 }]` converti en `-scale-y-100`
(correspondance Tailwind exacte, pas une approximation).
- Couvert par `messaging-attachment.yaml` (Maestro) : tape sur "📎" — relu avant de commencer, aucun texte
  changé.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90 à 104, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil, en particulier les bulles de message et le composeur.
- **Ce qui reste** : 2 écrans — `notes.tsx` (488 lignes), `attendance.tsx` (521 lignes).

**Seizième écran migré vers NativeWind** (itération 106) — `notes.tsx`, le plus petit des 2 écrans restants.
Trois familles de pastilles/onglets conditionnelles (Saisie/Classement, classe/matière, chips d'évaluation)
reprennent le patron de l'itération 95. Styles inline `{ flex: 2 }`/`{ flex: 1 }` du composeur d'évaluation
convertis en `flex-[2]`/`flex-1`.
- Couvert par `grades-entry.yaml` (Maestro) : "Saisie", placeholders "Libellé (ex. Devoir 1)"/"Poids (ex.
  25)"/"—", "Enregistrer les notes" — relu avant de commencer, aucun texte changé.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90 à 105, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil, en particulier les onglets et les trois familles de
  pastilles.
- **Ce qui reste** : 1 seul écran — `attendance.tsx` (521 lignes), le dernier de cette migration écran par
  écran.

**Dix-septième et DERNIER écran migré vers NativeWind** (itération 107) — `attendance.tsx`. Migration écran
par écran TERMINÉE : les 17 écrans mobiles sont désormais sur NativeWind, plus aucun sur `StyleSheet.create`
(`grep -rl "StyleSheet.create(" mobile/app/` renvoie zéro résultat). Statut à trois branches
(`statusChipActiveClassName`, même patron que `feeStatusClassName` de l'itération 100). Seul cas de toute la
série où une couleur était passée en PROP runtime (`TotalItem({ color })`) plutôt que fixée dans un style
statique — converti en `colorClassName` (une classe Tailwind complète par appelant, les trois appels
utilisant en réalité des littéraux fixes) plutôt que de tenter de faire porter une couleur dynamique jusqu'à
NativeWind, qui ne peut pas interpoler une prop dans une classe déjà compilée.
- Couvert par `attendance-entry.yaml` (Maestro) : "Saisie", chip "Absent", placeholder "Motif (facultatif)",
  "Enregistrer les présences", "Présences enregistrées." — relu avant de commencer, aucun texte changé.
- **Vérifié** : `tsc --noEmit` 0 erreur ; `npm test` — 6 suites, 27 tests, tous PASS ; `expo export` — export
  réussi, 1981 modules (identique aux itérations 90 à 106, aucune dépendance ajoutée). **Non vérifié,
  honnêtement** : le rendu visuel RÉEL sur un appareil — pour cet écran comme pour les 16 précédents, cette
  migration entière n'a validé que la compilation/le graphe Metro/les tests unitaires, jamais un rendu réel
  sur un appareil ou un émulateur.
- **Ce qui reste** : rien — migration terminée.

**Déclencheur de notification push pour les NOTES** (itération 110) — dernier déclencheur push manquant,
livré après délégation explicite (« poursuivre le développement mobile », deux `AskUserQuestion`
successives : le choix du sujet lui-même, puis le cadrage exact du déclencheur). Mime exactement le
déclencheur ABSENCES de l'itération 87, côté backend comme côté mobile.
- **Backend** — `grades.service.ts::notifyGradeGuardians` (nouvelle fonction, même forme que
  `attendance.service.ts::notifyAbsenceGuardians` : résout les `StudentGuardian` des élèves concernés,
  déduplique les tuteurs, récupère leurs jetons push, envoie un message Expo par jeton — best-effort,
  jamais bloquant, jamais `await`é au point d'appel). Branchée UNIQUEMENT sur `bulkSetGradeEvaluation`
  (`POST /schools/:schoolId/grades/bulk`) — seul point d'écriture des notes réellement câblé à une UI (web
  ET mobile n'appellent que cette route ; `createGrade`/`updateGrade`, les routes REST à la note unique,
  sont du code mort côté UI et n'ont donc pas reçu le déclencheur, pour ne pas ajouter un branchement
  invérifiable). Se déclenche sur CHAQUE note saisie OU modifiée (entrée avec une valeur réelle, pas sur
  `entry.value === null` qui représente une case vidée — même logique que RETARD qui ne déclenche pas côté
  absences, ABSENT qui déclenche) — cadrage confirmé explicitement par l'utilisateur (« Chaque note saisie
  ou modifiée »), et non déduit. Contrairement au push absence, la note elle-même N'EST PAS incluse dans le
  corps/les données du push (`data: {schoolId, studentId, subjectName, kind: "grade"}`, jamais la valeur) —
  décision prise à cette itération, une note affichée en clair sur un écran verrouillé étant plus sensible
  qu'un simple drapeau de présence.
- **Mobile** — `pushNotifications.ts::extractGradeNotificationData` (nouvel extracteur, même forme
  qu'`extractAbsenceNotificationData` : `schoolId`/`studentId`, discriminé par `kind: "grade"`) ;
  `extractMessagingNotificationData` étendu pour exclure aussi `kind: "grade"` (même garde défensive que
  pour `kind: "absence"`) ; troisième branche ajoutée au `handleResponse` unique de `app/_layout.tsx`, qui
  route — comme pour une absence — vers `children/[studentId]` (l'écran affiche déjà le bulletin, exactement
  ce dont un parent a besoin après une nouvelle note). Les trois extractions restent mutuellement exclusives
  par construction (`kind`), donc aucun risque de double navigation sur un seul tap.
- **Vérifié** : `tsc --noEmit` (backend ET mobile) 0 erreur ; `npm test` — 6 suites, 31 tests (4 nouveaux :
  extraction avec/sans le discriminant `kind: "grade"`, champ manquant, forme inattendue), tous PASS ;
  `expo export` — export réussi, 1981 modules (aucune dépendance ajoutée). **Non vérifié, honnêtement** : la
  réception/l'affichage RÉEL du push sur un appareil (comme pour le déclencheur absence, aucun compte EAS
  réel ni appareil/émulateur disponible dans ce bac à sable).
- **Ce qui reste** : les trois déclencheurs push du plan mobile (messagerie, absences, notes) sont
  désormais tous livrés côté code — seule leur réception réelle reste non vérifiable ici.

**Messagerie de GROUPE** (itération 111) — dernière lacune fonctionnelle mobile face au web volontairement
laissée de côté depuis l'itération 74 (« pas de gestion de groupe... conversations PRIVÉES uniquement depuis
mobile pour l'instant »). Suite de « poursuivre l'implémentation mobile app » : deux `AskUserQuestion`
successives, comme pour l'itération 110 — sujet choisi (messagerie de groupe plutôt que pièces jointes
PDF/bureautique, l'autre lacune identifiée), puis périmètre étendu à la création ET la gestion des membres
(ajout/retrait), pas seulement la création.
- **Aucun changement backend** : les routes `POST .../conversations` (déjà générique `type`/`title`), `POST
  .../participants` et `DELETE .../participants/:userId` existaient déjà, réservées côté web à
  `NewConversationDialog.tsx`/`ParticipantsDialog.tsx` — mobile consomme exactement les mêmes routes.
- `src/api/messaging.ts` — `useAddParticipantMutation`/`useRemoveParticipantMutation` (nouveau), miroir exact
  des mutations web de même nom. `useCreateConversationMutation` (itération 74) acceptait déjà `type`/`title`
  sans que l'écran les consomme — aucun changement ici.
- `messaging/index.tsx` — la vue "nouvelle conversation" gagne un second mode (`newMode`, bascule Message
  privé/Groupe) : en mode groupe, sélection MULTIPLE de contacts (case cochée simulée par un fond de couleur,
  aucun composant `Checkbox` dans ce projet mobile) + champ nom de groupe, puis "Créer le groupe (N
  membres)". La liste des conversations préfixe désormais les groupes d'un 👥 (parité visuelle légère avec
  l'icône `Users` du web, `ConversationList.tsx`).
- `messaging/[conversationId].tsx` → déplacé vers `messaging/[conversationId]/index.tsx` (même convention
  déjà en place pour `children/[studentId]/` — index.tsx + timetable.tsx) pour accueillir un second écran du
  même groupe de routes. Sous-titre du header devient "N membres" pour un groupe (au lieu de En ligne/Hors
  ligne, réservé aux conversations privées) ; bouton "Membres" ajouté au header (`headerRight`, **premier
  usage de cette option Expo Router dans ce projet**) visible UNIQUEMENT si `conversation.type === "GROUP" &&
  conversation.myRole === "ADMIN"` — même garde exacte que le web (`ChatWindow.tsx`).
- `messaging/[conversationId]/members.tsx` (nouveau) — écran de gestion des membres, miroir mobile de
  `ParticipantsDialog.tsx`, en écran de navigation plutôt qu'en dialogue modal (`Modal`/toute bibliothèque de
  dialogue jamais introduite dans ce projet mobile — un écran séparé atteint par `router.push` reprend le
  patron déjà établi pour tout autre écran de détail). Retrait avec confirmation (`Alert.alert` style
  destructif, même texte que le `ConfirmDialog` web) ; ajout par tap direct sur un contact non déjà membre
  (pas de `SelectField`, composant absent de ce projet mobile). N'expose PAS le "quitter le groupe" en
  self-service pour un simple membre (le backend l'autorise — `targetUserId === meId` — mais le web non plus
  ne l'expose nulle part, `ParticipantsDialog.tsx` n'étant monté que pour un ADMIN) : parité stricte avec le
  web à cette itération, pas d'ajout de fonctionnalité que le web lui-même n'a pas.
- `maestro/messaging-group.yaml` (nouveau) — non exécuté ici, même limite que les flows précédents.
- **Point technique notable** : nouveau fichier de route (`members.tsx`) — comme documenté depuis le
  correctif itération 77/l'itération 89, `.expo/types/router.d.ts` ne se régénère ni avec `tsc --noEmit` seul
  ni avec `expo export`, seulement via un cycle `expo start` complet (serveur + une requête de bundle réelle
  sur `entry.bundle`) — refait ici avant de vérifier.
- **Vérifié** : `tsc --noEmit` 0 erreur (après régénération de `router.d.ts` comme ci-dessus) ; `npm test` —
  6 suites, 31 tests, tous PASS (inchangé — aucun nouveau fichier de logique pure à tester, les nouvelles
  mutations sont de simples enveloppes REST comme `useMarkConversationReadMutation`, déjà non testées) ;
  `expo export` — export réussi, 1982 modules (+1, le nouveau fichier de route — aucune nouvelle dépendance).
  **Non vérifié, honnêtement** : le rendu visuel RÉEL sur un appareil (sélection multiple, bouton "Membres",
  écran de gestion) ; exécution réelle du flow Maestro.
- **Ce qui reste** : les deux lacunes fonctionnelles mobile identifiées face au web sont désormais réduites à
  une seule — les pièces jointes PDF/bureautique en Messagerie (voir ci-dessous), non choisies à cette
  itération.

**Pièces jointes PDF/bureautique en Messagerie** (itération 112) — dernière lacune fonctionnelle mobile face
au web, identifiée à l'itération 111 (l'autre candidate, non choisie ce jour-là). Suite de « poursuivre
l'implémentation » sans nouvelle question posée : un seul candidat restait, contrairement aux itérations
précédentes où deux options s'offraient. **Aucun changement backend** : `messaging.upload.ts::
ALLOWED_MIME_TYPES` acceptait déjà PDF/Word/Excel/texte/CSV/zip depuis toujours (utilisés par le web), seul
le client mobile ne les envoyait ni ne les ouvrait jamais.
- Trois nouvelles dépendances : `expo-document-picker@~57.0.2` (sélection), `expo-file-system@~57.0.7`
  (téléchargement d'une pièce jointe reçue), `expo-sharing@~57.0.21` (ouverture via le sélecteur d'app du
  système) — versions lues dans `expo/bundledNativeModules.json`, même précaution que toutes les
  dépendances natives ajoutées depuis l'itération 76. `expo-file-system` en version 57 expose une NOUVELLE
  API (classes `File`/`Directory`/`Paths`) qui remplace l'ancienne (`FileSystem.cacheDirectory`/
  `downloadAsync`, déplacée vers l'import `expo-file-system/legacy`) — utilisée directement, pas
  l'ancienne.
- `src/lib/photoPicker.ts` — `pickMessageDocument()` (nouveau), miroir de `pickMessageAttachment` pour un
  DOCUMENT plutôt qu'une image : liste blanche MIME alignée sur `ATTACHMENT_ALLOWED_MIME_TYPES` côté web
  moins les types image (déjà couverts par le bouton caméra/galerie existant). `presentPhotoSourceOptions`
  étendue avec un `onDocument` optionnel — troisième bouton "Choisir un document" UNIQUEMENT quand fourni,
  donc AUCUN changement de comportement pour `EditablePhoto.tsx` (identité élève/personnel/logo d'école),
  seul appelant à ne jamais le passer.
- `src/api/messaging.ts` — `useSendMessageWithAttachmentMutation` généralisée pour accepter
  `PickedAttachment` (nom/type RÉELS d'un document) en plus de `PickedPhoto` (nom/type reconstruits,
  comportement image inchangé) — même route, même mutation, un simple discriminant sur la forme de l'objet
  reçu.
- `src/lib/attachmentDownload.ts` (nouveau) — `downloadAndOpenAttachment`, réception : télécharge la pièce
  jointe via `File.downloadFileAsync` (jeton `Authorization: Bearer` explicite, même piège que
  `AttachmentImage.tsx`/`messageAttachmentUrl` — la route n'est jamais servie en statique) puis l'ouvre via
  `expo-sharing` (sélecteur d'app du système — seul moyen raisonnable d'"afficher" un PDF/document sur
  mobile, aucune visionneuse inline construite). Jeton récupéré directement via `getAccessToken()` plutôt
  que l'instance axios `api` — même compromis délibéré qu'`AttachmentImage.tsx` : pas de rafraîchissement
  automatique si le jeton expire pile à cet instant (fenêtre de 15 minutes), l'utilisateur retente
  simplement le tap.
- `messaging/[conversationId]/index.tsx` — une pièce jointe non-image REÇUE devient tapable (auparavant une
  simple étiquette statique, "NON ouvrable depuis mobile" comme le documentait l'itération 85) ; état de
  téléchargement local à chaque bulle de message (plusieurs pièces jointes indépendantes peuvent coexister
  dans un même fil).
- `maestro/messaging-document.yaml` (nouveau) — non exécuté ici, même limite que les flows précédents, mais
  **le plus fragile de tous** : le sélecteur de fichiers natif a une mise en page bien moins standardisée
  qu'un sélecteur de galerie photo (voir son propre commentaire d'en-tête).
- **Vérifié** : `npx tsc --noEmit` (mobile) — 0 erreur. `npm test` — 6 suites, 33 tests (2 nouveaux : bouton
  "Choisir un document" ajouté/déclenché quand `onDocument` est fourni), tous PASS. `EXPO_OFFLINE=1 npx expo
  export --platform android` — export réussi, 2008 modules (+26, les trois nouvelles dépendances et leur
  propre arbre — aucune régénération de `router.d.ts` nécessaire cette fois, aucun nouveau FICHIER de route).
  **Non vérifié, honnêtement** : le rendu visuel RÉEL sur un appareil (sélecteur de document, téléchargement,
  ouverture via le sélecteur de partage du système) — aucun appareil/émulateur disponible dans ce bac à
  sable, même limite que toutes les itérations mobile précédentes ; c'est en particulier la toute PREMIÈRE
  fois que ce projet mobile écrit sur le système de fichiers de l'appareil (`expo-file-system`) en dehors du
  cache MMKV (itération 76, un mécanisme complètement différent) — comportement runtime réel entièrement
  hors de portée de ce bac à sable.
- **Ce qui reste** : les DEUX lacunes fonctionnelles mobile identifiées face au web à l'itération 111 sont
  désormais toutes deux livrées côté code (messagerie de groupe à l'itération 111, pièces jointes PDF/
  bureautique à cette itération) — plus aucune lacune fonctionnelle connue de ce type face au web à ce
  stade.

**Portails Parent/Élève : vrai libellé de groupe** (itération 113) — plus aucune lacune mobile-vs-web ne
restait à ce stade (110-112 les ont toutes comblées), donc pas de suite directe cette fois : trois pistes web
non triviales identifiées et vérifiées contre le code RÉEL (voir `README.md` racine pour le détail des trois
candidates et la question posée), l'utilisateur a choisi le correctif du libellé de groupe affiché aux
comptes Parent/Élève — un bug documenté depuis l'itération 37 (`groupe.name` brut affiché, ex "A", au lieu du
libellé composé "6ème A") mais jamais corrigé faute de demande explicite ("à reconsidérer si demandé
explicitement"). **Correctif principal côté backend** (`utils/groupeLabel.ts`, nouveau — composition du
libellé déplacée côté serveur, voir `README.md` racine) : `parent-portal.service.ts`/
`student-portal.service.ts` renvoient désormais un champ `groupeLabel` déjà composé sur `GuardianChild`, en
plus du `groupe: { id, name }` historique (inchangé).
- Mobile consomme EXACTEMENT le même endpoint/la même forme `GuardianChild` que le web (voir le commentaire
  de ce type dans `src/types/index.ts`, "copié depuis frontend/src/types/index.ts, mêmes noms de champs
  EXACTEMENT") — le même bug existait donc aussi côté mobile, au même endroit conceptuel
  (`dashboard.tsx::ParentDashboard`, carte d'un enfant dans la liste "Mes enfants" d'un compte Parent),
  corrigé par cohérence plutôt que laissé de côté puisque le correctif backend le résolvait de toute façon
  gratuitement pour l'API — restait à l'afficher.
- `src/types/index.ts` — `GuardianChild.groupeLabel: string | null` ajouté, en miroir du web.
- `dashboard.tsx` — `item.groupeLabel ?? item.groupe?.name` au lieu de `item.groupe.name` seul.
- `children/[studentId]/index.tsx` (résumé d'un enfant pour son parent) vérifié : n'affichait déjà aucun
  libellé de groupe, rien à y changer.
- **Vérifié** : `npx tsc --noEmit` (mobile) — 0 erreur (aucun nouveau fichier de route). `npm test` — 6
  suites, 33 tests, tous PASS (aucun nouveau test : changement d'un écran d'affichage, pas d'une fonction
  pure — ce projet n'a par ailleurs aucun test unitaire backend/frontend non plus, cohérent de ne pas en
  ajouter ici). **Non vérifié** : rendu visuel réel (toujours aucun compte de test Parent/Élève ni vraie
  base Postgres dans ce bac à sable pour appeler ces endpoints en pratique).

## Ce qui n'est volontairement PAS fait (hors périmètre de ces phases)

La Phase 2 et la Phase 3 du plan mobile sont entièrement livrées (3a cache offline, 3b notifications push —
Messagerie + Absences (itération 87), 3c capture photo — Élèves/Personnel/Logo d'école (itération 89)) ; la Phase 4 est démarrée (tests unitaires +
scaffolding e2e, itération 81). Présence (itération 83) et Notes (itération 84) ont désormais toutes deux
une saisie mobile (Notes/Bulletins n'est donc plus lecture seule) ; champ "heure"/suivi par
période de la Présence non couvert par sa saisie (cas secondaire, la Saisie reste jour par jour, une plage
n'y aurait pas de sens) ; pièces jointes IMAGE en Messagerie
livrées à l'itération 85 (voir ci-dessus) ; messagerie de GROUPE (création + gestion des membres) livrée à
l'itération 111 ET pièces jointes PDF/bureautique livrées à l'itération 112 (voir ci-dessus) — plus aucune
lacune fonctionnelle mobile connue face au web à ce stade ; file de mutations offline en ÉCRITURE (hors périmètre par
décision explicite du plan, section 4.6 — écrans de saisie bloqués hors ligne plutôt que mis en file) ;
déclencheurs de notification push pour les ABSENCES (itération 87) ET pour les NOTES (itération 110, voir
ci-dessus) tous deux livrés — les trois déclencheurs du plan mobile (messagerie, absences, notes) sont
désormais complets ; configuration d'un vrai projet EAS (`eas init`),
préalable indispensable pour tester réellement la réception push — hors du périmètre de ce bac à sable ;
logo d'école éditable livré à l'itération 89 (voir ci-dessus) — Phase 3c (capture/upload photo) désormais
entièrement couverte (élèves, personnel, logo d'école) ; build EAS réel, soumission aux
stores et intégration CI (Phase 4, voir ci-dessus) ; **exécution réelle des flows Maestro** (écrits mais non
rejoués, aucun émulateur/simulateur disponible ici, voir `mobile/maestro/README.md`) ; **vérification du
comportement RUNTIME réel de `react-native-mmkv`, des notifications push ET de la capture photo sur un
appareil ou dev client** — aucun disponible dans cet environnement, seule la compilation TypeScript/le
graphe Metro/les tests unitaires ont pu être vérifiés (voir ci-dessus). Design system : **NativeWind
retenu et son infrastructure mise en place à l'itération 90, migration écran par écran TERMINÉE à
l'itération 107** — dix-sept écrans migrés au total (`settings.tsx` à l'itération 90, `schools/index.tsx` à
l'itération 92, `login.tsx` à l'itération 93, `register.tsx` à l'itération 94, `personnel/index.tsx` à
l'itération 95, `timetable.tsx` à l'itération 96, `children/[studentId]/timetable.tsx` à l'itération 97,
`bulletin/[studentId].tsx` à l'itération 98, `personnel/[staffId].tsx` à l'itération 99,
`children/[studentId]/index.tsx` à l'itération 100, `students/[studentId].tsx` à l'itération 101,
`messaging/index.tsx` à l'itération 102, `students/index.tsx` à l'itération 103, `dashboard.tsx` à
l'itération 104, `messaging/[conversationId].tsx` à l'itération 105, `notes.tsx` à l'itération 106,
`attendance.tsx` à l'itération 107 — voir ci-dessus) — **plus aucun écran sur `StyleSheet.create`**
(`grep -rl "StyleSheet.create(" mobile/app/` renvoie zéro résultat, voir "Itération 107"), jamais fait en
big-bang comme décidé à l'itération 90. **Tabs au niveau `[schoolId]` implémentés à l'itération 91** (voir ci-dessus) — Tableau de bord/Notes/
Présences/Messagerie pour le Personnel uniquement, Stack inchangé pour Parent/Élève (Notes/Présences leur
étaient déjà inaccessibles). Récapitulatif de présences désormais filtrable par période (raccourcis, itération 86) — reste
sans vrai calendrier, comme la Saisie (jour par jour uniquement). Filtre sexe sur la liste des élèves
ajouté à l'itération 88 (voir ci-dessus, parité avec le web) — correctif au passage : le web lui-même
(`StudentsPage.tsx`) ne filtre que par `groupeId` (classe+série combinés en un seul sélecteur) et sexe, PAS
par cycle/classe/série séparément (contrairement à ce qu'affirmait une note précédente de ce fichier) —
aucun écart mobile/web réel à combler sur ce point.
