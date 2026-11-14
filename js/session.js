// =====================================================================
// SESSION : qui est connecté, avec quel rôle, et la déconnexion
// =====================================================================
import { sb, DELAI_INACTIVITE, ROLES_DOSSIERS } from './config.js';
import { toast, allerA } from './outils.js';

// État partagé : la session Supabase et le profil de la personne connectée
export const etat = {
  session: null, // session de connexion (null si personne n'est connecté)
  moi: null,     // ligne de la table « profiles » : nom, e-mail, rôle, actif
};

// Lit la session en cours puis le profil associé
export async function chargerProfil() {
  const { data } = await sb.auth.getSession();
  etat.session = data.session;
  etat.moi = null;
  if (!etat.session) return;

  // La règle RLS « p_sel » autorise chacun à lire son propre profil
  const { data: profil } = await sb
    .from('profiles')
    .select('*')
    .eq('id', etat.session.user.id)
    .maybeSingle();
  etat.moi = profil;

  // Surveillance de l'inactivité seulement pour les comptes qui ont accès
  if (aAcces()) surveillerInactivite();
}

// La personne a-t-elle accès aux dossiers ? (compte actif + bon rôle)
export function aAcces() {
  return Boolean(etat.moi && etat.moi.actif && ROLES_DOSSIERS.includes(etat.moi.role));
}

// La personne fait-elle partie de la direction ? (accès Équipe et Journal)
export function estDirection() {
  return aAcces() && etat.moi.role === 'direction';
}

// Déconnexion, avec un message facultatif
export async function deconnexion(message) {
  clearTimeout(minuterieInactivite);
  await sb.auth.signOut();
  etat.session = null;
  etat.moi = null;
  if (message) toast(message);
  allerA('#/');
}

// ---------------------------------------------------------------------
// Déconnexion automatique après 20 minutes sans activité.
// Chaque clic, touche, mouvement ou défilement relance le compte à rebours.
// ---------------------------------------------------------------------
let minuterieInactivite = null;
let ecouteInstallee = false;

function relancerCompteARebours() {
  clearTimeout(minuterieInactivite);
  if (!etat.moi) return;
  minuterieInactivite = setTimeout(
    () => deconnexion('Session fermée après 20 minutes d’inactivité.'),
    DELAI_INACTIVITE
  );
}

function surveillerInactivite() {
  if (!ecouteInstallee) {
    ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach((evenement) =>
      addEventListener(evenement, relancerCompteARebours, { passive: true })
    );
    ecouteInstallee = true;
  }
  relancerCompteARebours();
}
