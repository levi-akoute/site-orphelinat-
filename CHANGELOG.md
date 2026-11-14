# CHANGELOG : Site de l'orphelinat Emmanuel

## v3 (2026-11-14) : refonte complète

**À faire par Levi après publication :** exécuter `supabase-02-ameliorations.sql` dans le SQL Editor de Supabase (une seule fois). Sans lui, la page Équipe, le statut « Sorti », les documents et le journal ne fonctionnent pas.

### Corrections de bugs
- La police des boutons ne s'appliquait pas (`font: 600 14px inherit` est du CSS invalide).
- Page Équipe : les nouveaux comptes s'affichaient sans nom ni e-mail. L'e-mail est maintenant enregistré dans `profiles`.
- Impossible de passer un enfant en « Sorti » ou de désarchiver : nouvelle fenêtre « Changer le statut », avec date et motif de sortie.
- Double chargement de la page après la connexion.
- Plantage si le navigateur bloquait l'ouverture d'un document.
- Âge parfois faux d'un an autour de l'anniversaire.
- Matricules `oeg-001` et `OEG-001` acceptés en double : la base met maintenant le matricule en majuscules.
- Dates incohérentes acceptées (admission avant naissance, dates futures) : contrôlées par la base.
- Fichier orphelin laissé dans le stockage si l'enregistrement d'un document échouait.

### Nouvelles fonctions
- Documents : remplacement du fichier et suppression (avec confirmation).
- Journal complet : créations, modifications, changements de statut, ajouts, remplacements et suppressions de documents, changements de compte, et **consultations** des fiches et des documents.
- Page « Journal d'activité » (direction) avec filtre par type d'action, et onglet « Historique » sur chaque fiche.
- Page « Mon compte » : changement de son mot de passe.
- Tableau de bord : chiffres clés (accueillis, admissions de l'année, sortis, archivés) et derniers dossiers modifiés.
- Recherche globale toujours visible (touche `/` pour y aller directement).

### Sécurité
- Bibliothèque Supabase chargée avec une empreinte SRI (`integrity`).
- Politique de sécurité CSP dans `index.html`.
- Un document ne peut être ouvert que si sa consultation a été notée dans le journal (règle sur le stockage).
- Protection côté base : la direction ne peut pas retirer son propre accès ; l'auteur et la date de création ne peuvent pas être falsifiés.
- Envoi de fichiers limité au dossier d'un enfant existant.
- Le site refuse de s'afficher dans un cadre (protection « clickjacking »).
- La page d'accueil publique ne montre plus de barre de recherche de dossiers : seulement la connexion.

### Design et code
- Nouveau design : menu latéral, cartes, onglets sur la fiche, fenêtres de dialogue, icônes, liste en cartes sur téléphone.
- Code réécrit et commenté en français, découpé en modules dans `js/` (`app.js` reste le point d'entrée).
- `style.css` réécrit et organisé en 10 sections commentées.
- Logos compressés en WebP (de 230 Ko à 9 Ko et 46 Ko) et icône d'onglet de 9 Ko. Les PNG d'origine sont conservés.
- Test : toutes les pages vérifiées dans Edge (ordinateur et téléphone) avec une base fictive, scénario de 17 vérifications réussi.

## v2 (2026-11-08)
- Version importée depuis `mes projets/mes projets creation de site/orphelinat-emmanuel v2/orphelinat-emmanuel/` le 2026-11-09.
- Stack : HTML, CSS, JavaScript + Supabase (`supabase.sql`).
- La clé Supabase dans `app.js` est une clé publishable (publique par conception). La sécurité repose sur les politiques RLS de `supabase.sql`.
