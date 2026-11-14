// =====================================================================
// ÉQUIPE (direction uniquement)
// Activer les comptes, leur donner un nom et un rôle.
// Les comptes eux-mêmes se créent dans Supabase (voir GUIDE.md, étape 4).
// =====================================================================
import { sb, LIBELLES_ROLES } from '../config.js';
import { etat } from '../session.js';
import { coque, chargement, remplirContenu, etatVide } from '../interface.js';
import { esc, icone, toast, messageErreur, nouvellePage, pageToujoursActive } from '../outils.js';

// Ce que chaque rôle permet (affiché en légende)
const DESCRIPTIONS_ROLES = {
  direction: 'Tous les dossiers, l’équipe et le journal d’activité.',
  administrateur: 'Les dossiers et les documents des enfants.',
  technique: 'Aucun accès aux dossiers (maintenance du site uniquement).',
};

export async function vueEquipe() {
  const numero = nouvellePage();
  coque(chargement(), 'equipe');

  const { data } = await sb.from('profiles').select('*').order('nom_complet');
  if (!pageToujoursActive(numero)) return;
  const comptes = data || [];

  // Les comptes jamais configurés (sans nom) apparaissent en premier
  comptes.sort((a, b) => Number(Boolean(a.nom_complet)) - Number(Boolean(b.nom_complet)));

  const optionsRoles = (roleActuel) => Object.entries(LIBELLES_ROLES)
    .map(([valeur, texte]) => `<option value="${valeur}" ${valeur === roleActuel ? 'selected' : ''}>${texte}</option>`)
    .join('');

  const lignes = comptes.map((p) => {
    const cEstMoi = p.id === etat.moi.id;
    // On ne peut pas modifier son propre rôle ni se désactiver (la base le refuse aussi)
    const bloque = cEstMoi ? 'disabled title="Vous ne pouvez pas modifier votre propre accès"' : '';
    return `
      <tr data-id="${p.id}">
        <td data-label="Nom complet">
          <input name="nom" value="${esc(p.nom_complet)}" placeholder="Nom et prénoms" aria-label="Nom complet" maxlength="80">
          <small class="discret">${esc(p.email || 'e-mail inconnu')}${cEstMoi ? ' · vous' : ''}
            ${!p.nom_complet ? ' · <span class="etiquette">nouveau compte</span>' : ''}</small>
        </td>
        <td data-label="Rôle"><select name="role" aria-label="Rôle" ${bloque}>${optionsRoles(p.role)}</select></td>
        <td data-label="Accès">
          <label class="interrupteur">
            <input type="checkbox" name="actif" ${p.actif ? 'checked' : ''} ${bloque}>
            <span>${p.actif ? 'Actif' : 'Inactif'}</span>
          </label>
        </td>
        <td class="cellule-action"><button class="btn btn-secondaire btn-petit" data-enregistrer>Enregistrer</button></td>
      </tr>`;
  }).join('');

  remplirContenu(`
    <div class="entete-page">
      <div>
        <p class="sur-titre">Direction</p>
        <h1>Équipe</h1>
      </div>
    </div>

    <section class="carte encadre-info">
      ${icone('utilisateur')}
      <div>
        <p><b>Ajouter une personne :</b> créez son compte dans Supabase (Authentication, Users, Add user),
        puis donnez-lui un nom, un rôle, et activez-la ici.</p>
        <ul class="legende-roles">
          ${Object.entries(DESCRIPTIONS_ROLES).map(([r, t]) => `<li><b>${LIBELLES_ROLES[r]}</b> : ${t}</li>`).join('')}
        </ul>
      </div>
    </section>

    <section class="carte carte-tableau">
      ${comptes.length
        ? `<table class="tableau tableau-equipe">
            <thead><tr><th>Personne</th><th>Rôle</th><th>Accès</th><th><span class="visuellement-cache">Action</span></th></tr></thead>
            <tbody>${lignes}</tbody>
          </table>`
        : etatVide('equipe', 'Aucun compte')}
    </section>`);

  // L'interrupteur affiche « Actif » ou « Inactif » en direct
  document.querySelectorAll('.interrupteur input').forEach((c) => {
    c.onchange = () => (c.nextElementSibling.textContent = c.checked ? 'Actif' : 'Inactif');
  });

  // Bouton « Enregistrer » de chaque ligne
  document.querySelectorAll('[data-enregistrer]').forEach((bouton) => {
    bouton.onclick = async () => {
      const ligne = bouton.closest('tr');
      const nom = ligne.querySelector('[name=nom]').value.trim();
      const role = ligne.querySelector('[name=role]').value;
      const actif = ligne.querySelector('[name=actif]').checked;

      // Activer un compte sans nom rendrait le journal illisible
      if (actif && !nom) return toast('Indiquez le nom de la personne avant de l’activer.', true);

      bouton.disabled = true;
      const { error } = await sb.from('profiles').update({ nom_complet: nom, role, actif }).eq('id', ligne.dataset.id);
      bouton.disabled = false;
      if (error) return toast(messageErreur(error, 'Mise à jour impossible.'), true);
      toast('Compte mis à jour.');
      // Si c'est mon propre nom qui change, le menu doit se mettre à jour
      if (ligne.dataset.id === etat.moi.id) {
        etat.moi.nom_complet = nom;
        vueEquipe();
      }
    };
  });
}
