// =====================================================================
// LISTE DES DOSSIERS
// Tableau filtrable (texte + statut). Sur téléphone, chaque ligne
// s'affiche comme une carte (voir style.css, section « Tableaux »).
// =====================================================================
import { sb } from '../config.js';
import { coque, chargement, remplirContenu, pastilleStatut, etatVide } from '../interface.js';
import { $, esc, icone, initiales, texteAge, formaterDate, nouvellePage, pageToujoursActive } from '../outils.js';

// Filtre de statut choisi : conservé quand on revient sur la page
let filtreStatut = '';

// statutDemande : statut passé dans l'adresse (#/dossiers/Sorti), facultatif
export async function vueDossiers(statutDemande) {
  const numero = nouvellePage();
  if (statutDemande !== undefined) {
    const statut = decodeURIComponent(statutDemande);
    filtreStatut = ['Actif', 'Sorti', 'Archivé'].includes(statut) ? statut : '';
  }
  coque(chargement(), 'dossiers');

  // On charge toutes les fiches (un orphelinat en compte quelques centaines au plus)
  const { data } = await sb
    .from('enfants')
    .select('id, matricule, nom, prenoms, sexe, date_naissance, date_admission, statut')
    .order('nom');
  if (!pageToujoursActive(numero)) return;
  const enfants = data || [];

  // Nombre de fiches par statut (affiché dans les boutons de filtre)
  const nombre = (statut) => enfants.filter((e) => !statut || e.statut === statut).length;
  const filtres = [['', 'Tous'], ['Actif', 'Actifs'], ['Sorti', 'Sortis'], ['Archivé', 'Archivés']];

  remplirContenu(`
    <div class="entete-page">
      <div>
        <p class="sur-titre">Dossiers</p>
        <h1>Dossiers des enfants</h1>
      </div>
    </div>

    <section class="carte carte-tableau">
      <div class="barre-filtres">
        <div class="champ-icone">
          ${icone('recherche')}
          <input id="filtre-texte" type="search" placeholder="Filtrer par nom ou matricule" aria-label="Filtrer par nom ou matricule">
        </div>
        <div class="filtres-statut" role="group" aria-label="Filtrer par statut">
          ${filtres.map(([valeur, texte]) => `
            <button type="button" class="filtre${valeur === filtreStatut ? ' actif' : ''}" data-statut="${valeur}"
              aria-pressed="${valeur === filtreStatut}">${texte} <span>${nombre(valeur)}</span></button>`).join('')}
        </div>
      </div>
      <div id="zone-tableau"></div>
    </section>`);

  // Dessine le tableau selon les filtres en cours
  const dessiner = () => {
    const texte = $('filtre-texte').value.trim().toLowerCase();
    const liste = enfants.filter((e) =>
      (!filtreStatut || e.statut === filtreStatut) &&
      `${e.matricule} ${e.nom} ${e.prenoms}`.toLowerCase().includes(texte)
    );

    // Aucun enfant du tout, ou aucun résultat pour ce filtre
    if (!liste.length) {
      $('zone-tableau').innerHTML = enfants.length
        ? etatVide('recherche', 'Aucun résultat', 'Essayez un autre nom, matricule ou statut.')
        : etatVide('dossiers', 'Aucun dossier pour l’instant', 'Ajoutez la fiche du premier enfant.',
            '<a class="btn btn-principal" href="#/nouveau">Ajouter un enfant</a>');
      return;
    }

    // data-label : sert d'intitulé quand le tableau devient une liste de cartes sur mobile
    $('zone-tableau').innerHTML = `
      <p class="compteur">${liste.length} dossier${liste.length > 1 ? 's' : ''}</p>
      <table class="tableau tableau-cliquable">
        <thead><tr><th>Enfant</th><th>Matricule</th><th>Âge</th><th>Admission</th><th>Statut</th></tr></thead>
        <tbody>
          ${liste.map((e) => `
          <tr data-id="${e.id}">
            <td class="cellule-enfant"><span class="avatar avatar-petit">${esc(initiales(e.nom, e.prenoms))}</span>
              <a href="#/enfant/${e.id}"><b>${esc(e.nom)}</b> ${esc(e.prenoms)}</a></td>
            <td data-label="Matricule" class="matricule">${esc(e.matricule)}</td>
            <td data-label="Âge">${texteAge(e.date_naissance) || '–'}</td>
            <td data-label="Admission">${formaterDate(e.date_admission) || '–'}</td>
            <td data-label="Statut">${pastilleStatut(e.statut)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  };

  // Toute la ligne est cliquable (le lien sur le nom reste pour le clavier)
  $('zone-tableau').onclick = (e) => {
    const ligne = e.target.closest('tr[data-id]');
    if (ligne && !e.target.closest('a')) location.hash = `#/enfant/${ligne.dataset.id}`;
  };

  // Filtre texte : redessine à chaque frappe (les données sont déjà chargées)
  $('filtre-texte').oninput = dessiner;

  // Filtres de statut : un seul actif à la fois
  document.querySelectorAll('.filtre').forEach((bouton) => {
    bouton.onclick = () => {
      filtreStatut = bouton.dataset.statut;
      document.querySelectorAll('.filtre').forEach((b) => {
        b.classList.toggle('actif', b === bouton);
        b.setAttribute('aria-pressed', String(b === bouton));
      });
      dessiner();
    };
  });

  dessiner();
}
