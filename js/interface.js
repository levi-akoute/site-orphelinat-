// =====================================================================
// INTERFACE COMMUNE
// Le cadre de toutes les pages (menu latéral + barre du haut), la recherche
// globale, les fenêtres de dialogue et quelques petits éléments réutilisés.
// =====================================================================
import { LIBELLES_ROLES } from './config.js';
import { etat, estDirection, deconnexion } from './session.js';
import { rechercherEnfants } from './donnees.js';
import { $, esc, icone, initiales, texteAge, differer } from './outils.js';

// ---------------------------------------------------------------------
// Petits éléments réutilisés
// ---------------------------------------------------------------------

// Pastille de couleur selon le statut (Actif = vert, Sorti = sable, Archivé = gris)
const CLASSES_STATUT = { Actif: 'actif', Sorti: 'sorti', Archivé: 'archive' };
export function pastilleStatut(statut) {
  return `<span class="pastille pastille-${CLASSES_STATUT[statut] || 'archive'}">${esc(statut)}</span>`;
}

// Bloc « chargement en cours » affiché pendant que la base répond
export function chargement(texte = 'Chargement…') {
  return `<div class="chargement" role="status"><span class="roue" aria-hidden="true"></span>${texte}</div>`;
}

// Message quand une liste est vide
export function etatVide(nomIcone, titre, texte = '', action = '') {
  return `<div class="etat-vide">${icone(nomIcone)}<p class="etat-vide-titre">${titre}</p>
    ${texte ? `<p>${texte}</p>` : ''}${action}</div>`;
}

// ---------------------------------------------------------------------
// Cadre de page : menu latéral + barre du haut + contenu
// « actif » indique quel lien du menu est en surbrillance.
// ---------------------------------------------------------------------
export function coque(contenu, actif) {
  const moi = etat.moi;

  // Un lien du menu, avec son icône
  const lien = (adresse, texte, cle, nomIcone) =>
    `<a href="${adresse}" class="menu-lien${actif === cle ? ' actif' : ''}"${actif === cle ? ' aria-current="page"' : ''}>
      ${icone(nomIcone)}<span>${texte}</span></a>`;

  // Les liens réservés à la direction
  const liensDirection = estDirection()
    ? `<p class="menu-titre">Direction</p>
       ${lien('#/equipe', 'Équipe', 'equipe', 'equipe')}
       ${lien('#/journal', 'Journal d’activité', 'journal', 'journal')}`
    : '';

  $('app').innerHTML = `
  <div class="cadre" id="cadre">
    <aside class="barre-laterale" id="barre-laterale">
      <a class="marque" href="#/">
        <img src="assets/logo-clair-96.webp" alt="" width="40" height="40">
        <span><b>Orphelinat Emmanuel</b><small>Espace du personnel</small></span>
      </a>
      <nav class="menu" aria-label="Menu principal">
        ${lien('#/', 'Tableau de bord', 'accueil', 'accueil')}
        ${lien('#/dossiers', 'Dossiers des enfants', 'dossiers', 'dossiers')}
        ${lien('#/nouveau', 'Ajouter un enfant', 'nouveau', 'plus')}
        ${liensDirection}
      </nav>
      <div class="profil-mini">
        <a href="#/compte" class="profil-mini-lien${actif === 'compte' ? ' actif' : ''}" title="Mon compte">
          <span class="avatar avatar-petit">${esc(initiales(...(moi.nom_complet || moi.email || '?').split(' ')))}</span>
          <span class="profil-mini-texte"><b>${esc(moi.nom_complet || moi.email || 'Utilisateur')}</b>
          <small>${LIBELLES_ROLES[moi.role] || ''}</small></span>
        </a>
        <button class="btn-icone btn-icone-clair" id="bouton-deconnexion" aria-label="Se déconnecter" title="Se déconnecter">
          ${icone('deconnexion')}</button>
      </div>
    </aside>
    <div class="voile" id="voile" hidden></div>
    <div class="principal">
      <header class="barre-haute">
        <button class="btn-icone bouton-menu" id="bouton-menu" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="barre-laterale">
          ${icone('menu')}</button>
        <div class="recherche-globale">
          ${icone('recherche')}
          <input id="recherche-globale" type="search" placeholder="Rechercher un enfant (nom ou matricule)"
            autocomplete="off" aria-label="Rechercher un enfant" aria-controls="resultats-globaux">
          <kbd class="raccourci" aria-hidden="true">/</kbd>
          <div class="resultats-globaux" id="resultats-globaux" hidden></div>
        </div>
        <a class="btn btn-principal bouton-ajout" href="#/nouveau">${icone('plus')}<span>Ajouter un enfant</span></a>
      </header>
      <main class="contenu" id="contenu">${contenu}</main>
    </div>
  </div>`;

  brancherCoque();
}

// Remplace seulement le contenu (sans redessiner le menu)
export function remplirContenu(html) {
  const zone = $('contenu');
  if (zone) zone.innerHTML = html;
}

// Branche les boutons du cadre : déconnexion, menu mobile, recherche globale
function brancherCoque() {
  $('bouton-deconnexion').onclick = () => deconnexion();

  // Menu mobile : le bouton ouvre/ferme le menu latéral, le voile le ferme
  const cadre = $('cadre');
  const boutonMenu = $('bouton-menu');
  const basculerMenu = (ouvert) => {
    cadre.classList.toggle('menu-ouvert', ouvert);
    $('voile').hidden = !ouvert;
    boutonMenu.setAttribute('aria-expanded', String(ouvert));
  };
  boutonMenu.onclick = () => basculerMenu(!cadre.classList.contains('menu-ouvert'));
  $('voile').onclick = () => basculerMenu(false);

  // Recherche globale : résultats affichés pendant la frappe
  const champ = $('recherche-globale');
  const zone = $('resultats-globaux');
  let numeroRecherche = 0; // ignore les réponses d'une recherche dépassée

  champ.oninput = differer(async () => {
    const texte = champ.value.trim();
    const numero = ++numeroRecherche;
    if (texte.length < 2) {
      zone.hidden = true;
      return;
    }
    const resultats = await rechercherEnfants(texte);
    if (numero !== numeroRecherche || !document.body.contains(zone)) return;
    zone.innerHTML = resultats.length
      ? resultats.map((r) => `
        <a class="resultat" href="#/enfant/${r.id}">
          <span class="avatar avatar-petit">${esc(initiales(r.nom, r.prenoms))}</span>
          <span class="resultat-texte"><b>${esc(r.nom)} ${esc(r.prenoms)}</b>
            <small>${esc(r.matricule)}${r.date_naissance ? ' · ' + texteAge(r.date_naissance) : ''}</small></span>
          ${pastilleStatut(r.statut)}
        </a>`).join('')
      : '<p class="resultat-vide">Aucun dossier ne correspond.</p>';
    zone.hidden = false;
  });

  // Échap vide la recherche ; Entrée ouvre le premier résultat
  champ.onkeydown = (e) => {
    if (e.key === 'Escape') {
      champ.value = '';
      zone.hidden = true;
    }
    if (e.key === 'Enter') {
      const premier = zone.querySelector('a.resultat');
      if (premier && !zone.hidden) location.hash = premier.getAttribute('href');
    }
  };
}

// Écoutes globales, installées une seule fois au démarrage (voir app.js)
export function installerRaccourcis() {
  // Touche « / » : place le curseur dans la recherche globale
  addEventListener('keydown', (e) => {
    const dansUnChamp = e.target.closest('input, textarea, select, [contenteditable]');
    if (e.key === '/' && !dansUnChamp && $('recherche-globale')) {
      e.preventDefault();
      $('recherche-globale').focus();
    }
  });
  // Clic en dehors de la recherche : on ferme la liste des résultats
  addEventListener('click', (e) => {
    const zone = $('resultats-globaux');
    if (zone && !e.target.closest('.recherche-globale')) zone.hidden = true;
  });
}

// ---------------------------------------------------------------------
// Fenêtre de dialogue (balise <dialog> native, accessible au clavier)
//
// surValider(formulaire) est appelée à la validation :
//   - elle renvoie true  → la fenêtre se ferme
//   - elle renvoie un texte → ce texte s'affiche comme erreur, la fenêtre reste ouverte
// ---------------------------------------------------------------------
export function ouvrirDialogue({ titre, contenu, texteValider = 'Valider', danger = false, surValider }) {
  const dialogue = document.createElement('dialog');
  dialogue.className = 'dialogue';
  dialogue.innerHTML = `
    <form method="dialog">
      <header class="dialogue-tete">
        <h2>${esc(titre)}</h2>
        <button type="button" class="btn-icone" data-fermer aria-label="Fermer">${icone('fermer')}</button>
      </header>
      <div class="dialogue-corps">${contenu}</div>
      <p class="dialogue-erreur" role="alert" hidden></p>
      <footer class="dialogue-pied">
        <button type="button" class="btn btn-secondaire" data-fermer>Annuler</button>
        <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-principal'}">${texteValider}</button>
      </footer>
    </form>`;
  document.body.append(dialogue);

  const formulaire = dialogue.querySelector('form');
  const zoneErreur = dialogue.querySelector('.dialogue-erreur');
  const boutonValider = dialogue.querySelector('button[type=submit]');

  // Boutons « Fermer » et « Annuler »
  dialogue.querySelectorAll('[data-fermer]').forEach((b) => (b.onclick = () => dialogue.close()));
  // Une fois fermée, la fenêtre est retirée de la page
  dialogue.addEventListener('close', () => dialogue.remove());

  // Validation : on bloque le bouton pendant l'attente pour éviter les doubles clics
  formulaire.onsubmit = async (e) => {
    e.preventDefault();
    zoneErreur.hidden = true;
    boutonValider.disabled = true;
    try {
      const resultat = await surValider(formulaire);
      if (resultat === true) dialogue.close();
      else if (typeof resultat === 'string') {
        zoneErreur.textContent = resultat;
        zoneErreur.hidden = false;
      }
    } finally {
      boutonValider.disabled = false;
    }
  };

  dialogue.showModal();
  return dialogue;
}
