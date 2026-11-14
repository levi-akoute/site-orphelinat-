// =====================================================================
// FORMULAIRE : ajouter un enfant (#/nouveau) ou modifier une fiche (#/modifier/<id>)
// Le statut ne se change pas ici, mais depuis la fiche (« Changer le statut »).
// =====================================================================
import { sb } from '../config.js';
import { coque, chargement, remplirContenu } from '../interface.js';
import { $, esc, icone, aujourdhuiISO, toast, messageErreur, allerA, nouvellePage, pageToujoursActive } from '../outils.js';

// Liste des champs que ce formulaire a le droit d'envoyer à la base.
// Tout le reste (statut, auteur, dates de création…) est ignoré.
const CHAMPS = [
  'matricule', 'nom', 'prenoms', 'sexe', 'date_naissance', 'lieu_naissance',
  'date_admission', 'provenance', 'motif_admission', 'remarques',
];

export async function vueFormulaire(id) {
  const numero = nouvellePage();
  coque(chargement(), id ? 'dossiers' : 'nouveau');

  // En modification : on charge la fiche existante
  let enfant = {};
  if (id) {
    const { data } = await sb.from('enfants').select('*').eq('id', id).maybeSingle();
    if (!pageToujoursActive(numero)) return;
    if (!data) {
      toast('Dossier introuvable.', true);
      return allerA('#/dossiers');
    }
    enfant = data;
  }

  const aujourdhui = aujourdhuiISO();

  // Fabrique un champ de saisie simple, pré-rempli en modification
  const champ = (nom, libelle, { type = 'text', requis = false, extra = '' } = {}) => `
    <label>${libelle}${requis ? ' *' : ''}
      <input name="${nom}" type="${type}" value="${esc(enfant[nom])}" ${requis ? 'required' : ''} ${extra}>
    </label>`;

  // Fabrique une zone de texte sur toute la largeur
  const zoneTexte = (nom, libelle, aide = '') => `
    <label class="champ-large">${libelle}
      <textarea name="${nom}" rows="3" placeholder="${aide}">${esc(enfant[nom])}</textarea>
    </label>`;

  const optionsSexe = ['Non renseigné', 'Masculin', 'Féminin']
    .map((s) => `<option ${s === (enfant.sexe || 'Non renseigné') ? 'selected' : ''}>${s}</option>`).join('');

  const retour = id ? `#/enfant/${id}` : '#/dossiers';

  remplirContenu(`
    <a class="lien-retour" href="${retour}">${icone('retour')}${id ? 'Retour à la fiche' : 'Dossiers des enfants'}</a>
    <div class="entete-page">
      <div>
        <p class="sur-titre">${id ? esc(enfant.matricule) : 'Nouveau dossier'}</p>
        <h1>${id ? 'Modifier la fiche' : 'Ajouter un enfant'}</h1>
      </div>
    </div>

    <form class="carte formulaire" id="formulaire-enfant">
      <fieldset>
        <legend>Identité</legend>
        <div class="grille-formulaire">
          ${champ('matricule', 'Matricule', { requis: true, extra: 'maxlength="30" placeholder="Ex. OEG-001" class="majuscules" autocapitalize="characters"' })}
          <label>Sexe<select name="sexe">${optionsSexe}</select></label>
          ${champ('nom', 'Nom', { requis: true, extra: 'maxlength="80" autocomplete="off"' })}
          ${champ('prenoms', 'Prénoms', { requis: true, extra: 'maxlength="120" autocomplete="off"' })}
          ${champ('date_naissance', 'Date de naissance', { type: 'date', extra: `max="${aujourdhui}"` })}
          ${champ('lieu_naissance', 'Lieu de naissance', { extra: 'maxlength="120"' })}
        </div>
      </fieldset>

      <fieldset>
        <legend>Accueil à l’orphelinat</legend>
        <div class="grille-formulaire">
          ${champ('date_admission', 'Date d’admission', { type: 'date', extra: `max="${aujourdhui}"` })}
          ${champ('provenance', 'Provenance', { extra: 'maxlength="160" placeholder="Ex. Service social de Yamoussoukro"' })}
          ${zoneTexte('motif_admission', 'Motif d’admission')}
        </div>
      </fieldset>

      <fieldset>
        <legend>Remarques</legend>
        <div class="grille-formulaire">
          ${zoneTexte('remarques', 'Informations utiles au quotidien', 'Santé, allergies, scolarité…')}
        </div>
      </fieldset>

      <p class="message-erreur" id="erreur-formulaire" role="alert" hidden></p>
      <div class="formulaire-pied">
        <a class="btn btn-secondaire" href="${retour}">Annuler</a>
        <button class="btn btn-principal" id="bouton-enregistrer">Enregistrer la fiche</button>
      </div>
    </form>`);

  $('formulaire-enfant').onsubmit = async (e) => {
    e.preventDefault();
    const erreur = $('erreur-formulaire');
    const bouton = $('bouton-enregistrer');
    const saisie = new FormData(e.target);

    // On ne garde que les champs autorisés ; un champ vide devient « null »
    const donnees = {};
    CHAMPS.forEach((nom) => {
      const valeur = String(saisie.get(nom) ?? '').trim();
      donnees[nom] = valeur === '' ? null : valeur;
    });
    donnees.matricule = (donnees.matricule || '').toUpperCase();
    donnees.sexe = donnees.sexe || 'Non renseigné';

    // Vérification simple avant d'envoyer (la base revérifie de toute façon)
    if (donnees.date_naissance && donnees.date_admission && donnees.date_admission < donnees.date_naissance) {
      erreur.textContent = 'La date d’admission ne peut pas précéder la date de naissance.';
      erreur.hidden = false;
      return;
    }

    bouton.disabled = true;
    erreur.hidden = true;

    // Création ou modification selon le cas
    const requete = id
      ? sb.from('enfants').update(donnees).eq('id', id)
      : sb.from('enfants').insert(donnees);
    const { data, error } = await requete.select('id').single();

    bouton.disabled = false;
    if (error) {
      erreur.textContent = messageErreur(error, 'Enregistrement impossible. Réessayez.');
      erreur.hidden = false;
      return;
    }
    toast(id ? 'Fiche mise à jour.' : 'Fiche créée.');
    allerA(`#/enfant/${data.id}`);
  };
}
