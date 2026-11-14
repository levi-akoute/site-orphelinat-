// =====================================================================
// MON COMPTE : informations de la personne connectée + changement de mot de passe
// =====================================================================
import { sb, LIBELLES_ROLES } from '../config.js';
import { etat } from '../session.js';
import { coque } from '../interface.js';
import { $, esc, icone, initiales, toast, nouvellePage } from '../outils.js';

const LONGUEUR_MIN = 10; // longueur minimale d'un mot de passe

export function vueCompte() {
  nouvellePage();
  const moi = etat.moi;

  coque(`
    <div class="entete-page">
      <div>
        <p class="sur-titre">Paramètres</p>
        <h1>Mon compte</h1>
      </div>
    </div>

    <div class="grille-compte">
      <section class="carte compte-identite">
        <span class="avatar avatar-grand">${esc(initiales(...(moi.nom_complet || moi.email || '?').split(' ')))}</span>
        <h2>${esc(moi.nom_complet || 'Nom non renseigné')}</h2>
        <p class="discret">${esc(moi.email || etat.session.user.email || '')}</p>
        <p><span class="etiquette">${LIBELLES_ROLES[moi.role] || esc(moi.role)}</span></p>
      </section>

      <section class="carte">
        <h2 class="titre-icone">${icone('cle')}Changer mon mot de passe</h2>
        <form class="formulaire-simple" id="formulaire-mdp">
          <label>Nouveau mot de passe
            <input type="password" name="mdp" required minlength="${LONGUEUR_MIN}" autocomplete="new-password">
            <small class="discret">Au moins ${LONGUEUR_MIN} caractères. Une phrase facile à retenir est idéale.</small>
          </label>
          <label>Confirmer le mot de passe
            <input type="password" name="confirmation" required autocomplete="new-password">
          </label>
          <p class="message-erreur" id="erreur-mdp" role="alert" hidden></p>
          <button class="btn btn-principal" id="bouton-mdp">Enregistrer le mot de passe</button>
        </form>
      </section>
    </div>`, 'compte');

  $('formulaire-mdp').onsubmit = async (e) => {
    e.preventDefault();
    const formulaire = e.target;
    const erreur = $('erreur-mdp');
    const afficherErreur = (texte) => {
      erreur.textContent = texte;
      erreur.hidden = false;
    };
    erreur.hidden = true;

    // Les deux saisies doivent être identiques
    if (formulaire.mdp.value !== formulaire.confirmation.value) {
      return afficherErreur('Les deux mots de passe ne sont pas identiques.');
    }

    $('bouton-mdp').disabled = true;
    const { error } = await sb.auth.updateUser({ password: formulaire.mdp.value });
    $('bouton-mdp').disabled = false;

    if (error) {
      // Supabase refuse par exemple un mot de passe identique à l'ancien ou trop faible
      return afficherErreur('Changement refusé : ' + error.message);
    }
    formulaire.reset();
    toast('Mot de passe modifié.');
  };
}
