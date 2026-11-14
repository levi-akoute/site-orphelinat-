# Guide pas à pas : mettre le site en marche

**Pendant les tests, utilise uniquement des données fictives.**

## Les fichiers du site

| Fichier | Rôle |
|---|---|
| `index.html` | La page unique du site (sécurité CSP, chargement des scripts) |
| `style.css` | Tout le design, en 10 sections commentées |
| `app.js` | Point d'entrée : choisit la page à afficher selon l'adresse |
| `js/config.js` | Adresse et clé Supabase, réglages (rôles, types de documents…) |
| `js/outils.js` | Petites fonctions partagées (dates, messages, icônes, sécurité) |
| `js/session.js` | Connexion, rôle, déconnexion automatique |
| `js/donnees.js` | Requêtes communes (recherche, noms du journal) |
| `js/interface.js` | Menu, barre du haut, recherche globale, fenêtres de dialogue |
| `js/vues/*.js` | Une page par fichier (connexion, tableau de bord, dossiers, fiche…) |
| `assets/` | Logos (WebP légers + PNG d'origine) et icône d'onglet |
| `supabase.sql` | La base, partie 1 (tables, sécurité RLS) |
| `supabase-02-ameliorations.sql` | La base, partie 2 (e-mail, sortie, documents, journal complet) |

## Étape 1. Créer la base sur Supabase
1. Va sur supabase.com, crée un compte, puis **New project**.
2. Donne un nom (`orphelinat-emmanuel`), choisis un **mot de passe de base de données fort** (note-le), et la région la plus proche de la Côte d'Ivoire proposée. Clique **Create**.
3. Attends 1 à 2 minutes que le projet démarre.

## Étape 2. Créer les tables et la sécurité
1. Menu de gauche : **SQL Editor**, puis **New query**.
2. Copie tout le contenu de `supabase.sql`, colle-le, clique **Run**. Tu dois voir « Success ».
3. **New query** à nouveau : copie tout `supabase-02-ameliorations.sql`, colle, **Run**. « Success » aussi.
4. Ça crée : les tables, les règles de sécurité (RLS), le stockage privé des documents et le journal d'activité.

> Projet déjà créé avec la v2 ? N'exécute que le point 3 (le fichier 02), une seule fois.

## Étape 3. Fermer les inscriptions (important)
**Authentication**, puis **Sign In / Providers**, puis **Email** : désactive **Allow new users to sign up**. Sans ça, n'importe qui pourrait créer un compte (il resterait inactif, mais mieux vaut fermer la porte).

## Étape 4. Créer les comptes (toi, le directeur, le 2ᵉ admin)
Pour **chaque personne** :
1. **Authentication**, **Users**, **Add user**, **Create new user**. Saisis l'e-mail et un mot de passe fort, coche **Auto Confirm User**.
2. Le compte est créé **inactif**. Active le premier compte direction dans **SQL Editor** (change l'e-mail et le nom) :
```sql
update profiles set nom_complet = 'Nom Prénom', role = 'direction', actif = true
where email = 'directeur@exemple.com';
```
Rôles : `direction` (tout, gère l'équipe et voit le journal), `administrateur` (dossiers et documents), `technique` (aucun accès aux dossiers dans le site).
3. Ensuite, la **direction** active les comptes suivants **depuis le site** (page **Équipe** : nom, rôle, case « Actif »). Toi, garde le rôle `technique`.

## Étape 5. Relier le site à Supabase
1. Supabase : **Project Settings**, **API** (ou le bouton **Connect**). Copie le **Project URL** et la clé **anon / publishable**.
2. Ouvre `js/config.js` et remplace les deux valeurs `SUPABASE_URL` et `SUPABASE_KEY`.
3. Si l'adresse du projet change, remplace-la aussi dans `index.html`, dans la ligne `Content-Security-Policy` (partie `connect-src`). Sinon le navigateur bloquera la connexion.

La clé anon est publique par conception, la sécurité vient des règles RLS. **Ne mets jamais la clé `service_role`** dans le site.

## Étape 6. Tester sur ton PC
Dans VS Code, installe l'extension **Live Server**, clic droit sur `index.html`, **Open with Live Server**.
(Ouvrir `index.html` par double-clic ne marche pas : les modules JavaScript exigent un serveur.)

Connecte-toi avec le compte direction et teste :
- ajouter un enfant, essayer un matricule en double (`oeg-001` puis `OEG-001`) ;
- changer le statut en « Sorti » (la date de sortie est obligatoire), puis revenir à « Actif » ;
- ajouter, ouvrir, remplacer et supprimer un document ;
- vérifier que tout apparaît dans **Journal d'activité** et dans l'onglet **Historique** de la fiche.

**Test de sécurité obligatoire :** ouvre le site dans une fenêtre privée **sans te connecter**, ouvre la console (F12) et tape :
```js
const { createClient } = window.supabase;
const t = createClient('TON_URL', 'TA_CLE');
(await t.from('enfants').select()).data
```
Tu dois obtenir une liste vide. Teste aussi un compte non activé : il ne doit rien voir.

## Étape 7. Publier (GitHub Pages)
Le dossier local est relié au dépôt GitHub `levi-akoute/site-orphelinat-`. On publie **uniquement avec `/commit`** dans Jarvis (pas avec « Upload files » sur GitHub).

- GitHub Pages gratuit exige un dépôt **public** : le code est visible, mais il ne contient aucun secret. Les données sont protégées par la connexion et le RLS.
- **Ne mets jamais de vraies données dans GitHub** (ni export de base, ni documents).
- Adresse du site : `https://levi-akoute.github.io/site-orphelinat-/`
- Supabase : **Authentication**, **URL Configuration**, mets cette adresse dans **Site URL**.

## Étape 8. Mot de passe oublié
Le site ne peut pas envoyer d'e-mail de réinitialisation (le plan gratuit de Supabase limite fortement les e-mails). Procédure :
1. Toi (technique), dans **Authentication**, **Users** : ouvre le compte, puis **Send password recovery**. Si l'e-mail n'arrive pas, définis un mot de passe provisoire dans le **SQL Editor** :
```sql
update auth.users set encrypted_password = extensions.crypt('MotDePasseProvisoire2026', extensions.gen_salt('bf'))
where email = 'personne@exemple.com';
```
2. La personne se connecte, puis change son mot de passe dans **Mon compte** (en bas du menu).

## Étape 9. Sauvegardes et pause (plan gratuit)
- Le plan gratuit **met le projet en pause après 7 jours sans activité** et **ne fait pas de sauvegarde automatique** (à confirmer sur supabase.com/pricing).
- Chaque semaine : connecte-toi au site et exporte les tables (**Table Editor**, **Export to CSV**). Garde les exports hors GitHub.

## Avant les vrais dossiers
- Plan **Pro** de Supabase (sauvegardes, pas de pause), ou le serveur que financera l'orphelinat.
- Vérifier avec le directeur les obligations de protection des données (ARTCI en Côte d'Ivoire).
- Autorisation écrite du directeur pour ton accès technique.
- Nouveau test de sécurité complet, et 2FA pour la direction.

## Ajouter une personne plus tard
Étape 4 (créer le compte dans Supabase), puis lui donner un nom, un rôle et l'activer dans la page **Équipe**.
