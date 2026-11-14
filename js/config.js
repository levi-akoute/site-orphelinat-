// =====================================================================
// CONFIGURATION DU SITE
// Les deux valeurs viennent de Supabase > Project Settings > API.
// La clé « publishable » est publique par conception : la vraie sécurité
// est assurée par les règles RLS de la base (voir les fichiers .sql).
// NE JAMAIS mettre ici la clé « service_role ».
// =====================================================================

// Adresse du projet Supabase
export const SUPABASE_URL = 'https://frfgwhvaypnwbbodsaxa.supabase.co';

// Clé publique (publishable / anon)
export const SUPABASE_KEY = 'sb_publishable_FEla-tWS2BxXiAKY8V3tUw_ggVBoR58';

// Client Supabase partagé par tout le site.
// window.supabase est fourni par le script chargé dans index.html.
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Déconnexion automatique après 20 minutes sans activité
export const DELAI_INACTIVITE = 20 * 60 * 1000;

// Rôles qui ont accès aux dossiers des enfants
// (le rôle « technique » n'a accès à rien dans le site)
export const ROLES_DOSSIERS = ['direction', 'administrateur'];

// Libellés lisibles des rôles
export const LIBELLES_ROLES = {
  direction: 'Direction',
  administrateur: 'Administrateur',
  technique: 'Technique',
};

// Documents : formats acceptés (type MIME → extension du fichier enregistré)
export const TYPES_FICHIERS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

// Documents : taille maximale (10 Mo, la même limite que dans la base)
export const TAILLE_MAX_FICHIER = 10 * 1024 * 1024;

// Catégories de documents proposées dans la liste déroulante
export const TYPES_DOCUMENTS = [
  'Acte de naissance',
  'Carnet de santé',
  'Scolarité',
  'Décision de placement',
  'Photo',
  'Autre',
];

// Les trois statuts possibles d'un dossier, avec leur explication
export const STATUTS = {
  Actif: 'L’enfant vit actuellement à l’orphelinat.',
  Sorti: 'L’enfant a quitté l’orphelinat (famille, adoption, majorité…).',
  Archivé: 'Dossier clos, conservé sans suppression.',
};
