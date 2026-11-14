// =====================================================================
// OUTILS PARTAGÉS
// Petites fonctions utilisées par toutes les pages : sécurité de l'affichage,
// dates, messages, icônes, navigation.
// =====================================================================

// Raccourci pour récupérer un élément par son id
export const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------
// Sécurité : échapper le texte avant de l'insérer dans le HTML.
// Sans ça, un nom contenant <script> pourrait exécuter du code (faille XSS).
// À utiliser sur TOUTE donnée qui vient de la base ou d'un formulaire.
// ---------------------------------------------------------------------
const REMPLACEMENTS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(texte) {
  return String(texte ?? '').replace(/[&<>"']/g, (c) => REMPLACEMENTS[c]);
}

// ---------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------

// Date du jour au format AAAA-MM-JJ (pour les champs <input type="date">)
export function aujourdhuiISO() {
  const d = new Date();
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}

// Affiche une date en français : 2026-11-14 → 14/11/2026
// Les dates simples (AAAA-MM-JJ) sont découpées à la main pour éviter
// tout décalage de fuseau horaire.
export function formaterDate(valeur) {
  if (!valeur) return '';
  if (valeur.length === 10) {
    const [annee, mois, jour] = valeur.split('-');
    return `${jour}/${mois}/${annee}`;
  }
  return new Date(valeur).toLocaleDateString('fr-FR');
}

// Date et heure : 14/11/2026 à 15:42
export function formaterDateHeure(valeur) {
  if (!valeur) return '';
  const d = new Date(valeur);
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${d.toLocaleDateString('fr-FR')} à ${heure}`;
}

// Âge exact en années (tient compte du jour et du mois d'anniversaire)
export function calculerAge(dateNaissance) {
  if (!dateNaissance) return null;
  const [annee, mois, jour] = dateNaissance.split('-').map(Number);
  const auj = new Date();
  let age = auj.getFullYear() - annee;
  const moisActuel = auj.getMonth() + 1;
  // Anniversaire pas encore passé cette année : on retire un an
  if (moisActuel < mois || (moisActuel === mois && auj.getDate() < jour)) age--;
  return age;
}

// Âge en texte : « 1 an », « 7 ans », « moins d’un an »
export function texteAge(dateNaissance) {
  const age = calculerAge(dateNaissance);
  if (age === null) return '';
  if (age < 1) return 'moins d’un an';
  return age === 1 ? '1 an' : `${age} ans`;
}

// ---------------------------------------------------------------------
// Divers affichages
// ---------------------------------------------------------------------

// Taille d'un fichier lisible : 524288 → « 512 Ko »
export function tailleFichier(octets) {
  if (!octets) return '0 Ko';
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

// Initiales pour les pastilles rondes : « KOUASSI Awa » → « KA »
export function initiales(...mots) {
  const lettres = mots.filter(Boolean).map((m) => m.trim()[0] || '').join('');
  return (lettres || '?').slice(0, 2).toUpperCase();
}

// Valeur affichée, ou mention grise « Non renseigné »
export function ouVide(valeur, texteVide = 'Non renseigné') {
  return valeur ? esc(valeur) : `<span class="vide">${texteVide}</span>`;
}

// ---------------------------------------------------------------------
// Messages (bandeau en bas de l'écran)
// ---------------------------------------------------------------------
let minuterieToast = null;
export function toast(message, erreur = false) {
  const zone = $('toast');
  zone.textContent = message;
  zone.className = 'toast visible' + (erreur ? ' toast-erreur' : '');
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => (zone.className = 'toast'), 3500);
}

// Traduit une erreur Supabase en message compréhensible
export function messageErreur(erreur, parDefaut = 'L’opération a échoué. Réessayez.') {
  if (!erreur) return parDefaut;
  if (erreur.code === '23505') return 'Ce matricule existe déjà.'; // doublon (unique)
  if (erreur.code === 'P0001') return erreur.message; // message écrit dans nos triggers SQL
  if (erreur.code === '42501') return 'Action non autorisée pour votre compte.'; // refus RLS
  if (String(erreur.message || '').includes('Failed to fetch')) return 'Connexion internet indisponible.';
  return parDefaut;
}

// ---------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------

// Aller à une page. Si on y est déjà, on force quand même le réaffichage.
export function allerA(adresse) {
  if (location.hash === adresse) dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = adresse;
}

// Chaque affichage de page reçoit un numéro. Quand une page attend la base
// et que l'utilisateur est déjà parti ailleurs, elle ne doit pas s'afficher.
let numeroPage = 0;
export const nouvellePage = () => ++numeroPage;
export const pageToujoursActive = (numero) => numero === numeroPage;

// Attendre que l'utilisateur ait fini de taper avant de lancer une recherche
export function differer(fonction, delai = 250) {
  let minuterie;
  return (...args) => {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => fonction(...args), delai);
  };
}

// ---------------------------------------------------------------------
// Icônes SVG (dessinées au trait, couleur = couleur du texte)
// ---------------------------------------------------------------------
const ICONES = {
  accueil: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  dossiers: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  equipe: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  journal: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  recherche: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  deconnexion: '<path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3"/><path d="m16 16 4-4-4-4M20 12H9"/>',
  modifier: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  fichier: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  ouvrir: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  corbeille: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  remplacer: '<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>',
  drapeau: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
  cle: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>',
  fermer: '<path d="M6 6l12 12M18 6 6 18"/>',
  retour: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  televerser: '<path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  utilisateur: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  bouclier: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  enfant: '<circle cx="12" cy="6" r="3"/><path d="M8 21v-5l-2-1 2-5h8l2 5-2 1v5"/>',
  sortie: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M3 12h11M10 8l4 4-4 4"/>',
  calendrier: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
};

// Renvoie le code SVG d'une icône. aria-hidden : les lecteurs d'écran l'ignorent
// (le texte du bouton ou son aria-label suffit).
export function icone(nom) {
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONES[nom] || ''}</svg>`;
}
