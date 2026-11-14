// =====================================================================
// POINT D'ENTRÉE DU SITE
// Lit l'adresse (la partie après #) et affiche la bonne page.
//
//   #/                    tableau de bord
//   #/dossiers            liste des enfants (#/dossiers/Sorti : filtre)
//   #/enfant/<id>         fiche d'un enfant
//   #/nouveau             ajouter un enfant
//   #/modifier/<id>       modifier une fiche
//   #/equipe              équipe (direction)
//   #/journal             journal d'activité (direction)
//   #/compte              mon compte
//
// Le code est découpé en fichiers dans le dossier js/ :
//   config.js, outils.js, session.js, donnees.js, interface.js, vues/*.js
// =====================================================================
import { sb } from './js/config.js';
import { etat, chargerProfil, aAcces, estDirection } from './js/session.js';
import { installerRaccourcis } from './js/interface.js';
import { vueConnexion, vueAttente } from './js/vues/connexion.js';
import { vueTableauDeBord } from './js/vues/tableau-de-bord.js';
import { vueDossiers } from './js/vues/dossiers.js';
import { vueFiche } from './js/vues/fiche.js';
import { vueFormulaire } from './js/vues/formulaire.js';
import { vueEquipe } from './js/vues/equipe.js';
import { vueJournal } from './js/vues/journal.js';
import { vueCompte } from './js/vues/compte.js';

// Choisit la page à afficher selon l'adresse et selon la personne connectée
function afficherPage() {
  // « #/enfant/abc » → page = « enfant », parametre = « abc »
  const [, page = '', parametre] = location.hash.split('/');

  // Personne de connecté : toujours la page de connexion.
  // L'adresse demandée est gardée : on y retourne après la connexion.
  if (!etat.session) return vueConnexion();

  // Connecté mais compte inactif, ou rôle sans accès aux dossiers
  if (!aAcces()) return vueAttente();

  // On remonte en haut de la page à chaque changement de page
  scrollTo(0, 0);

  switch (page) {
    case 'dossiers': return vueDossiers(parametre);
    case 'enfant': return vueFiche(parametre);
    case 'nouveau': return vueFormulaire();
    case 'modifier': return vueFormulaire(parametre);
    case 'compte': return vueCompte();
    case 'equipe': return estDirection() ? vueEquipe() : vueTableauDeBord();
    case 'journal': return estDirection() ? vueJournal() : vueTableauDeBord();
    default: return vueTableauDeBord();
  }
}

async function demarrer() {
  // Protection : le site refuse de s'afficher à l'intérieur d'un autre site
  // (technique du « clickjacking »)
  if (window.top !== window.self) {
    document.body.textContent = 'Ce site ne peut pas être affiché dans un cadre.';
    return;
  }

  await chargerProfil();

  // Déconnexion venue d'ailleurs (autre onglet, session expirée) : retour à la connexion
  sb.auth.onAuthStateChange((evenement) => {
    if (evenement === 'SIGNED_OUT' && etat.session) {
      etat.session = null;
      etat.moi = null;
      afficherPage();
    }
  });

  installerRaccourcis();
  addEventListener('hashchange', afficherPage);
  afficherPage();
}

demarrer();
