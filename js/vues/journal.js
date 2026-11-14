// =====================================================================
// JOURNAL D'ACTIVITÉ (direction uniquement)
// Qui a créé, modifié, supprimé ou consulté quoi, et quand.
// Le journal est écrit par la base : personne ne peut le modifier ni l'effacer.
// =====================================================================
import { sb } from '../config.js';
import { chargerNoms, LIBELLES_ACTIONS } from '../donnees.js';
import { coque, chargement, remplirContenu, etatVide } from '../interface.js';
import { $, esc, icone, formaterDateHeure, nouvellePage, pageToujoursActive } from '../outils.js';

const PAR_PAGE = 50; // nombre de lignes chargées à chaque fois

export async function vueJournal() {
  const numero = nouvellePage();
  coque(chargement(), 'journal');

  const noms = await chargerNoms();
  if (!pageToujoursActive(numero)) return;

  remplirContenu(`
    <div class="entete-page">
      <div>
        <p class="sur-titre">Direction</p>
        <h1>Journal d’activité</h1>
      </div>
    </div>
    <section class="carte carte-tableau">
      <div class="barre-filtres">
        <label class="champ-en-ligne">Type d’action
          <select id="filtre-action">
            <option value="">Toutes les actions</option>
            ${Object.entries(LIBELLES_ACTIONS).map(([v, t]) => `<option value="${v}">${t}s</option>`).join('')}
          </select>
        </label>
      </div>
      <div id="zone-journal">${chargement()}</div>
      <div class="pied-tableau"><button class="btn btn-secondaire" id="bouton-plus" hidden>Charger plus</button></div>
    </section>`);

  let page = 0;          // numéro de la page de résultats déjà chargée
  let lignesHtml = '';   // lignes déjà affichées

  // Charge une page de résultats (50 lignes) ; « reinitialiser » repart du début
  async function charger(reinitialiser) {
    if (reinitialiser) {
      page = 0;
      lignesHtml = '';
      $('zone-journal').innerHTML = chargement();
    }
    const action = $('filtre-action').value;
    let requete = sb.from('journal').select('*').order('created_at', { ascending: false })
      .range(page * PAR_PAGE, page * PAR_PAGE + PAR_PAGE - 1); // de la ligne X à la ligne Y
    if (action) requete = requete.eq('action', action);
    const { data } = await requete;
    if (!$('zone-journal')) return; // page quittée entre-temps

    const lignes = data || [];
    lignesHtml += lignes.map((l) => `
      <tr>
        <td data-label="Date" class="cellule-date">${formaterDateHeure(l.created_at)}</td>
        <td data-label="Personne">${esc(noms.get(l.user_id) || 'Système')}</td>
        <td data-label="Action"><span class="etiquette etiquette-${(l.action || '').toLowerCase()}">${LIBELLES_ACTIONS[l.action] || esc(l.action)}</span></td>
        <td data-label="Détail">${esc(l.detail || l.entite || '')}
          ${l.enfant_id ? `<a class="lien-discret" href="#/enfant/${l.enfant_id}">voir le dossier ${icone('chevron')}</a>` : ''}</td>
      </tr>`).join('');

    $('zone-journal').innerHTML = lignesHtml
      ? `<table class="tableau"><thead><tr><th>Date</th><th>Personne</th><th>Action</th><th>Détail</th></tr></thead>
         <tbody>${lignesHtml}</tbody></table>`
      : etatVide('journal', 'Aucune activité enregistrée');

    // Bouton « Charger plus » visible seulement s'il reste probablement des lignes
    $('bouton-plus').hidden = lignes.length < PAR_PAGE;
    page++;
  }

  $('filtre-action').onchange = () => charger(true);
  $('bouton-plus').onclick = () => charger(false);
  charger(true);
}
