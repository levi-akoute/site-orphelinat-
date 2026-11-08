# Guide pas à pas : mettre le site en marche

Fichiers : `index.html`, `style.css`, `app.js` et le dossier `assets` (le site et son logo), `supabase.sql` (la base).
**Pendant les tests, utilise uniquement des données fictives.**

## Étape 1. Créer la base sur Supabase
1. Va sur supabase.com, crée un compte, puis **New project**.
2. Donne un nom (`orphelinat-emmanuel`), choisis un **mot de passe de base de données fort** (note-le), et la région la plus proche de la Côte d'Ivoire proposée. Clique **Create**.
3. Attends 1 à 2 minutes que le projet démarre.

## Étape 2. Créer les tables et la sécurité
1. Menu de gauche : **SQL Editor**, puis **New query**.
2. Copie tout le contenu de `supabase.sql`, colle-le, clique **Run**. Tu dois voir « Success ».
3. Ça crée : les tables, les règles de sécurité (RLS), le stockage privé des documents et le journal d'activité.

## Étape 3. Fermer les inscriptions (important)
**Authentication**, puis **Sign In / Providers**, puis **Email** : désactive **Allow new users to sign up**. Sans ça, n'importe qui pourrait créer un compte (il resterait inactif, mais mieux vaut fermer la porte).

## Étape 4. Créer les comptes (toi, le directeur, le 2ᵉ admin)
Pour **chaque personne** :
1. **Authentication**, **Users**, **Add user**, **Create new user**. Saisis l'e-mail et un mot de passe fort, coche **Auto Confirm User**.
2. Le compte est créé **inactif**. Active-le dans **SQL Editor** (change l'e-mail, le nom et le rôle) :
```sql
update profiles set nom_complet = 'Nom Prénom', role = 'direction', actif = true
where id = (select id from auth.users where email = 'directeur@exemple.com');
```
Rôles : `direction` (tout, gère l'équipe), `administrateur` (dossiers et documents), `technique` (aucun accès aux dossiers dans le site).
3. Une fois la **direction** activée, elle active les comptes suivants **depuis le site** (page **Équipe**). Toi, garde le rôle `technique`.

## Étape 5. Relier le site à Supabase
1. Supabase : **Project Settings**, **API** (ou le bouton **Connect**). Copie le **Project URL** et la clé **anon / publishable**.
2. Ouvre `app.js` et remplace les deux lignes en haut :
```js
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_KEY = 'ta-clé-anon';
```
La clé anon est publique par conception, la sécurité vient des règles RLS. **Ne mets jamais la clé `service_role`** dans le site.

## Étape 6. Tester sur ton PC
Dans VS Code, installe l'extension **Live Server**, clic droit sur `index.html`, **Open with Live Server**. Connecte-toi avec le compte direction et teste : ajouter un enfant, un matricule en double, un document, l'archivage.

**Test de sécurité obligatoire :** ouvre le site dans une fenêtre privée **sans te connecter**, ouvre la console (F12) et tape `sb.from('enfants').select()`. Tu dois obtenir une liste vide. Teste aussi un compte non activé : il ne doit rien voir.

## Étape 7. Dépôt GitHub
1. Crée un compte sur github.com, puis **New repository** : nom `orphelinat-emmanuel`.
2. Envoie les fichiers : **Add file**, **Upload files**, glisse `index.html`, `style.css`, `app.js`, le dossier `assets`, `supabase.sql`, puis **Commit**.
3. **Visibilité : attention.** GitHub Pages gratuit exige un dépôt **public**, et même avec un dépôt privé payant le **site** reste public. Ce n'est pas grave ici : le code ne contient aucun secret, et les données sont protégées par la connexion et le RLS. Mais **ne mets jamais de vraies données dans GitHub** (ni export de base, ni documents).
4. Si tu veux un dépôt réellement privé gratuitement, **Cloudflare Pages** ou **Netlify** savent déployer depuis un dépôt privé (à vérifier sur leurs sites). Le site restera accessible par son adresse, protégé par la connexion.

## Étape 8. Mettre le site en ligne (GitHub Pages)
1. Dans le dépôt : **Settings**, **Pages**, **Deploy from a branch**, branche `main`, dossier `/ (root)`, **Save**.
2. Après 1 à 2 minutes, l'adresse apparaît : `https://TON-PSEUDO.github.io/orphelinat-emmanuel/`.
3. Supabase : **Authentication**, **URL Configuration**, mets cette adresse dans **Site URL**.

## Étape 9. Sauvegardes et pause (plan gratuit)
- Le plan gratuit **met le projet en pause après 7 jours sans activité** et **ne fait pas de sauvegarde automatique** (à confirmer sur supabase.com/pricing).
- Chaque semaine : connecte-toi au site et exporte les tables (**Table Editor**, **Export to CSV**). Garde les exports hors GitHub.

## Avant les vrais dossiers
- Plan **Pro** de Supabase (sauvegardes, pas de pause), ou le serveur que financera l'orphelinat.
- Vérifier avec le directeur les obligations de protection des données (ARTCI en Côte d'Ivoire).
- Autorisation écrite du directeur pour ton accès technique.
- Nouveau test de sécurité complet, et 2FA pour la direction.

## Ajouter une personne plus tard
Étape 4 (créer le compte dans Supabase), puis l'activer dans la page **Équipe**.
