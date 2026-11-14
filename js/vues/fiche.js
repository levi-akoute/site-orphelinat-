// =====================================================================
// FICHE D'UN ENFANT
// En-tête (nom, matricule, statut, actions) + 3 onglets :
//   - Informations : identité, accueil, sortie, remarques
//   - Documents    : liste, ajout, ouverture, remplacement, suppression
//   - Historique   : journal de ce dossier (direction uniquement)
// =====================================================================
import { sb, STATUTS, TYPES_DOCUMENTS, TYPES_FICHIERS, TAILLE_MAX_FICHIER } from '../config.js';
import { estDirection } from '../session.js';
import { chargerNoms, LIBELLES_ACTIONS } from '../donnees.js';
import { coque, chargement, remplirContenu, pastilleStatut, ouvrirDialogue, etatVide } from '../interface.js';
import {
  $, esc, icone, initiales, ouVide, texteAge, formaterDate, formaterDateHeure, aujourdhuiISO,
  tailleFichier, toast, messageErreur, allerA, nouvellePage, pageToujoursActive,
} from '../outils.js';

let ongletActif = 'infos'; // onglet affiché, gardé quand la fiche se recharge
let ficheCourante = null;  // id de l'enfant affiché

// ---------------------------------------------------------------------
// Point d'entrée : appelé par le routeur pour #/enfant/<id>
// ---------------------------------------------------------------------
export async function vueFiche(id) {
  // Nouvel enfant : on revient sur le premier onglet
  if (ficheCourante !== id) {
    ongletActif = 'infos';
    ficheCourante = id;
  }
  coque(chargement(), 'dossiers');

  // On note la consultation dans le journal (une fois par ouverture de fiche,
  // pas à chaque rechargement après une action)
  sb.rpc('noter_consultation', { p_entite: 'enfants', p_id: id }).then(({ error }) => {
    if (error) console.warn('Consultation non journalisée :', error.message);
  });

  await afficherFiche(id);
}

// ---------------------------------------------------------------------
// Charge l'enfant et ses documents, puis dessine la fiche
// ---------------------------------------------------------------------
async function afficherFiche(id) {
  const numero = nouvellePage();
  const [reponseEnfant, reponseDocuments] = await Promise.all([
    sb.from('enfants').select('*').eq('id', id).maybeSingle(),
    sb.from('documents').select('*').eq('enfant_id', id).order('created_at', { ascending: false }),
  ]);
  if (!pageToujoursActive(numero)) return;

  const enfant = reponseEnfant.data;
  const documents = reponseDocuments.data || [];
  if (!enfant) {
    toast('Dossier introuvable.', true);
    return allerA('#/dossiers');
  }

  // Les onglets disponibles (l'historique est réservé à la direction)
  const onglets = [
    ['infos', 'Informations'],
    ['documents', `Documents <span class="compte">${documents.length}</span>`],
    ...(estDirection() ? [['historique', 'Historique']] : []),
  ];
  if (!onglets.some(([cle]) => cle === ongletActif)) ongletActif = 'infos';

  // Ligne d'infos sous le nom : âge, sexe
  const sousTitre = [
    enfant.date_naissance ? texteAge(enfant.date_naissance) : '',
    enfant.sexe !== 'Non renseigné' ? enfant.sexe : '',
  ].filter(Boolean).join(' · ');

  remplirContenu(`
    <a class="lien-retour" href="#/dossiers">${icone('retour')}Dossiers des enfants</a>

    <section class="carte fiche-tete">
      <span class="avatar avatar-grand">${esc(initiales(enfant.nom, enfant.prenoms))}</span>
      <div class="fiche-identite">
        <h1>${esc(enfant.nom)} ${esc(enfant.prenoms)}</h1>
        <p class="fiche-meta">
          <span class="matricule">${esc(enfant.matricule)}</span>
          ${pastilleStatut(enfant.statut)}
          ${sousTitre ? `<span class="discret">${esc(sousTitre)}</span>` : ''}
        </p>
      </div>
      <div class="fiche-actions">
        <button class="btn btn-secondaire" id="bouton-statut">${icone('drapeau')}Changer le statut</button>
        <a class="btn btn-principal" href="#/modifier/${enfant.id}">${icone('modifier')}Modifier</a>
      </div>
    </section>

    <div class="onglets" role="tablist" aria-label="Sections de la fiche">
      ${onglets.map(([cle, texte]) => `
        <button type="button" role="tab" class="onglet" id="onglet-${cle}" data-onglet="${cle}"
          aria-controls="panneau-${cle}" aria-selected="${cle === ongletActif}">${texte}</button>`).join('')}
    </div>

    <section class="carte panneau" id="panneau-infos" role="tabpanel" aria-labelledby="onglet-infos"
      ${ongletActif === 'infos' ? '' : 'hidden'}>${htmlInformations(enfant)}</section>

    <section class="carte panneau" id="panneau-documents" role="tabpanel" aria-labelledby="onglet-documents"
      ${ongletActif === 'documents' ? '' : 'hidden'}>${htmlDocuments(documents)}</section>

    ${estDirection() ? `<section class="carte panneau" id="panneau-historique" role="tabpanel"
      aria-labelledby="onglet-historique" ${ongletActif === 'historique' ? '' : 'hidden'}>${chargement()}</section>` : ''}
  `);

  brancherOnglets(enfant.id);
  $('bouton-statut').onclick = () => dialogueStatut(enfant);
  brancherDocuments(enfant, documents);
  if (ongletActif === 'historique') chargerHistorique(enfant.id);
}

// Recharge la fiche sans noter une nouvelle consultation
const recharger = (id) => afficherFiche(id);

// ---------------------------------------------------------------------
// Onglets
// ---------------------------------------------------------------------
function brancherOnglets(id) {
  let historiqueCharge = ongletActif === 'historique';
  document.querySelectorAll('[role=tab]').forEach((bouton) => {
    bouton.onclick = () => {
      ongletActif = bouton.dataset.onglet;
      // Un seul onglet sélectionné, un seul panneau visible
      document.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b === bouton)));
      document.querySelectorAll('[role=tabpanel]').forEach((p) => (p.hidden = p.id !== `panneau-${ongletActif}`));
      // L'historique n'est chargé qu'à la première ouverture de l'onglet
      if (ongletActif === 'historique' && !historiqueCharge) {
        historiqueCharge = true;
        chargerHistorique(id);
      }
    };
  });
}

// ---------------------------------------------------------------------
// Onglet « Informations »
// ---------------------------------------------------------------------
function htmlInformations(e) {
  // Un champ : intitulé + valeur (ou « Non renseigné »)
  const champ = (libelle, valeur, large = false) =>
    `<div class="champ${large ? ' champ-large' : ''}"><dt>${libelle}</dt><dd>${valeur}</dd></div>`;

  const naissance = e.date_naissance
    ? `${formaterDate(e.date_naissance)} <span class="discret">(${texteAge(e.date_naissance)})</span>`
    : ouVide('');

  // La section « Sortie » n'apparaît que si l'enfant est sorti (ou a une date de sortie)
  const sortie = e.statut === 'Sorti' || e.date_sortie
    ? `<h3>Sortie</h3><dl class="champs">
        ${champ('Date de sortie', ouVide(formaterDate(e.date_sortie), 'Non renseignée'))}
        ${champ('Motif de sortie', ouVide(e.motif_sortie), true)}
      </dl>`
    : '';

  return `
    <h3>Identité</h3>
    <dl class="champs">
      ${champ('Nom', ouVide(e.nom))}
      ${champ('Prénoms', ouVide(e.prenoms))}
      ${champ('Sexe', ouVide(e.sexe === 'Non renseigné' ? '' : e.sexe))}
      ${champ('Date de naissance', naissance)}
      ${champ('Lieu de naissance', ouVide(e.lieu_naissance))}
    </dl>
    <h3>Accueil</h3>
    <dl class="champs">
      ${champ('Date d’admission', ouVide(formaterDate(e.date_admission), 'Non renseignée'))}
      ${champ('Provenance', ouVide(e.provenance))}
      ${champ('Motif d’admission', ouVide(e.motif_admission), true)}
    </dl>
    ${sortie}
    <h3>Remarques</h3>
    <p class="texte-libre">${ouVide(e.remarques, 'Aucune remarque')}</p>
    <p class="pied-fiche">Fiche créée le ${formaterDate(e.created_at)}${e.updated_at ? `, modifiée le ${formaterDateHeure(e.updated_at)}` : ''}</p>`;
}

// ---------------------------------------------------------------------
// Changement de statut (fenêtre de dialogue)
// ---------------------------------------------------------------------
function dialogueStatut(enfant) {
  const options = Object.entries(STATUTS).map(([statut, explication]) => `
    <label class="option-radio">
      <input type="radio" name="statut" value="${statut}" ${statut === enfant.statut ? 'checked' : ''}>
      <span><b>${statut}</b><small>${explication}</small></span>
    </label>`).join('');

  const dialogue = ouvrirDialogue({
    titre: 'Changer le statut',
    texteValider: 'Enregistrer',
    contenu: `
      <fieldset class="choix-statut"><legend class="visuellement-cache">Nouveau statut</legend>${options}</fieldset>
      <fieldset class="champs-sortie" id="champs-sortie">
        <legend>Sortie de l’enfant</legend>
        <label>Date de sortie *
          <input type="date" name="date_sortie" required max="${aujourdhuiISO()}" value="${esc(enfant.date_sortie)}">
        </label>
        <label>Motif de sortie
          <textarea name="motif_sortie" rows="3" placeholder="Retour en famille, adoption, majorité…">${esc(enfant.motif_sortie)}</textarea>
        </label>
      </fieldset>`,
    surValider: async (formulaire) => {
      const statut = formulaire.statut.value;
      const modifications = { statut };
      // Les infos de sortie ne sont envoyées que pour « Sorti »
      // (pour « Actif », la base les efface ; pour « Archivé », elle les garde)
      if (statut === 'Sorti') {
        modifications.date_sortie = formulaire.date_sortie.value;
        modifications.motif_sortie = formulaire.motif_sortie.value.trim() || null;
      }
      const { error } = await sb.from('enfants').update(modifications).eq('id', enfant.id);
      if (error) return messageErreur(error, 'Changement de statut impossible.');
      toast(`Statut enregistré : ${statut}.`);
      recharger(enfant.id);
      return true;
    },
  });

  // Les champs de sortie ne sont visibles (et obligatoires) que si « Sorti » est coché.
  // Un fieldset désactivé n'est pas vérifié par le navigateur.
  const champsSortie = dialogue.querySelector('#champs-sortie');
  const mettreAJour = () => {
    const sorti = dialogue.querySelector('input[name=statut]:checked')?.value === 'Sorti';
    champsSortie.hidden = !sorti;
    champsSortie.disabled = !sorti;
  };
  dialogue.querySelectorAll('input[name=statut]').forEach((r) => (r.onchange = mettreAJour));
  mettreAJour();
}

// ---------------------------------------------------------------------
// Onglet « Documents »
// ---------------------------------------------------------------------
const OPTIONS_TYPES = TYPES_DOCUMENTS.map((t) => `<option>${t}</option>`).join('');
const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

function htmlDocuments(documents) {
  const liste = documents.length
    ? `<ul class="documents">${documents.map((d) => `
        <li class="document">
          <span class="document-icone">${icone(d.mime === 'application/pdf' ? 'fichier' : 'image')}</span>
          <div class="document-texte">
            <b>${esc(d.titre)}</b>
            <small>${esc(d.type || 'Autre')} · ajouté le ${formaterDate(d.created_at)} · ${tailleFichier(d.taille)}
              ${d.updated_at ? ` · remplacé le ${formaterDate(d.updated_at)}` : ''}</small>
          </div>
          <div class="document-actions">
            <button class="btn btn-secondaire btn-petit" data-action="ouvrir" data-id="${d.id}">${icone('ouvrir')}Ouvrir</button>
            <button class="btn-icone" data-action="remplacer" data-id="${d.id}" title="Remplacer le fichier"
              aria-label="Remplacer le fichier de ${esc(d.titre)}">${icone('remplacer')}</button>
            <button class="btn-icone btn-icone-danger" data-action="supprimer" data-id="${d.id}" title="Supprimer"
              aria-label="Supprimer ${esc(d.titre)}">${icone('corbeille')}</button>
          </div>
        </li>`).join('')}</ul>`
    : etatVide('fichier', 'Aucun document', 'Ajoutez l’acte de naissance, le carnet de santé, les bulletins…');

  return `
    ${liste}
    <form class="ajout-document" id="formulaire-document">
      <h3>${icone('televerser')}Ajouter un document</h3>
      <div class="grille-formulaire">
        <label>Titre *<input name="titre" required maxlength="120" placeholder="Ex. Acte de naissance original"></label>
        <label>Catégorie<select name="type">${OPTIONS_TYPES}</select></label>
        <label class="champ-large">Fichier (PDF, JPG ou PNG, 10 Mo maximum) *
          <input type="file" name="fichier" accept="${ACCEPT}" required></label>
      </div>
      <button class="btn btn-principal" id="bouton-ajout-document">${icone('televerser')}Ajouter le document</button>
    </form>`;
}

// Vérifie un fichier avant envoi : renvoie un message d'erreur, ou null si tout va bien
function verifierFichier(fichier) {
  if (!fichier) return 'Choisissez un fichier.';
  if (!TYPES_FICHIERS[fichier.type]) return 'Formats acceptés : PDF, JPG, PNG.';
  if (fichier.size > TAILLE_MAX_FICHIER) return 'Le fichier dépasse 10 Mo.';
  return null;
}

// Envoie un fichier dans le dossier de l'enfant, sous un nom aléatoire
// (le vrai nom du fichier n'apparaît jamais dans le stockage)
async function envoyerFichier(enfantId, fichier) {
  const chemin = `${enfantId}/${crypto.randomUUID()}.${TYPES_FICHIERS[fichier.type]}`;
  const { error } = await sb.storage.from('documents').upload(chemin, fichier, { contentType: fichier.type });
  return { chemin, error };
}

function brancherDocuments(enfant, documents) {
  // --- Ajout d'un document ---
  $('formulaire-document').onsubmit = async (e) => {
    e.preventDefault();
    const formulaire = e.target;
    const fichier = formulaire.fichier.files[0];
    const probleme = verifierFichier(fichier);
    if (probleme) return toast(probleme, true);

    const bouton = $('bouton-ajout-document');
    bouton.disabled = true;
    bouton.textContent = 'Envoi en cours…';

    // 1. Envoi du fichier dans le stockage privé
    const envoi = await envoyerFichier(enfant.id, fichier);
    if (envoi.error) {
      bouton.disabled = false;
      bouton.textContent = 'Ajouter le document';
      return toast('Envoi du fichier impossible.', true);
    }
    // 2. Enregistrement de la fiche du document dans la base
    const { error } = await sb.from('documents').insert({
      enfant_id: enfant.id,
      titre: formulaire.titre.value.trim(),
      type: formulaire.type.value,
      chemin: envoi.chemin,
      mime: fichier.type,
      taille: fichier.size,
    });
    if (error) {
      // Échec : on efface le fichier envoyé pour ne pas laisser d'orphelin
      await sb.storage.from('documents').remove([envoi.chemin]);
      bouton.disabled = false;
      bouton.textContent = 'Ajouter le document';
      return toast(messageErreur(error, 'Enregistrement du document impossible.'), true);
    }
    toast('Document ajouté.');
    ongletActif = 'documents';
    recharger(enfant.id);
  };

  // --- Boutons de chaque document (un seul écouteur pour toute la liste) ---
  const liste = document.querySelector('.documents');
  if (!liste) return;
  liste.onclick = (e) => {
    const bouton = e.target.closest('button[data-action]');
    if (!bouton) return;
    const doc = documents.find((d) => d.id === bouton.dataset.id);
    if (bouton.dataset.action === 'ouvrir') ouvrirDocument(doc);
    if (bouton.dataset.action === 'remplacer') dialogueRemplacer(enfant, doc);
    if (bouton.dataset.action === 'supprimer') dialogueSupprimer(enfant, doc);
  };
}

// Ouvre un document dans un nouvel onglet
async function ouvrirDocument(doc) {
  // L'onglet est ouvert TOUT DE SUITE (pendant le clic), sinon le navigateur le bloque
  const onglet = window.open('', '_blank');

  // 1. On note la consultation : sans elle, la base refuse l'accès au fichier
  const consultation = await sb.rpc('noter_consultation', { p_entite: 'documents', p_id: doc.id });
  // 2. On demande un lien temporaire (valable 60 secondes)
  const lien = consultation.error
    ? { error: consultation.error }
    : await sb.storage.from('documents').createSignedUrl(doc.chemin, 60);

  if (lien.error) {
    if (onglet) onglet.close();
    return toast('Ouverture du document impossible.', true);
  }
  if (onglet) {
    onglet.opener = null; // le nouvel onglet ne peut pas agir sur le site
    onglet.location = lien.data.signedUrl;
  } else {
    // Fenêtres bloquées par le navigateur : on ouvre le lien directement
    window.open(lien.data.signedUrl, '_blank', 'noopener');
  }
}

// Remplacer le fichier d'un document (le titre et la catégorie restent)
function dialogueRemplacer(enfant, doc) {
  ouvrirDialogue({
    titre: 'Remplacer le fichier',
    texteValider: 'Remplacer',
    contenu: `
      <p>Nouveau fichier pour <b>${esc(doc.titre)}</b>. L’ancien fichier sera effacé définitivement.
      Le remplacement est enregistré dans le journal.</p>
      <label>Fichier (PDF, JPG ou PNG, 10 Mo maximum) *
        <input type="file" name="fichier" accept="${ACCEPT}" required></label>`,
    surValider: async (formulaire) => {
      const fichier = formulaire.fichier.files[0];
      const probleme = verifierFichier(fichier);
      if (probleme) return probleme;

      // 1. Envoi du nouveau fichier
      const envoi = await envoyerFichier(enfant.id, fichier);
      if (envoi.error) return 'Envoi du fichier impossible.';
      // 2. Le document pointe maintenant vers le nouveau fichier
      const { error } = await sb.from('documents')
        .update({ chemin: envoi.chemin, mime: fichier.type, taille: fichier.size })
        .eq('id', doc.id);
      if (error) {
        await sb.storage.from('documents').remove([envoi.chemin]);
        return messageErreur(error, 'Remplacement impossible.');
      }
      // 3. Effacement de l'ancien fichier
      await sb.storage.from('documents').remove([doc.chemin]);
      toast('Document remplacé.');
      ongletActif = 'documents';
      recharger(enfant.id);
      return true;
    },
  });
}

// Supprimer un document (après confirmation)
function dialogueSupprimer(enfant, doc) {
  ouvrirDialogue({
    titre: 'Supprimer le document',
    texteValider: 'Supprimer définitivement',
    danger: true,
    contenu: `<p>Supprimer <b>${esc(doc.titre)}</b> ? Le fichier sera effacé et ne pourra pas être récupéré.
      La suppression est enregistrée dans le journal.</p>`,
    surValider: async () => {
      // 1. Suppression de la fiche du document (journalisée par la base)
      const { error } = await sb.from('documents').delete().eq('id', doc.id);
      if (error) return messageErreur(error, 'Suppression impossible.');
      // 2. Effacement du fichier dans le stockage
      await sb.storage.from('documents').remove([doc.chemin]);
      toast('Document supprimé.');
      ongletActif = 'documents';
      recharger(enfant.id);
      return true;
    },
  });
}

// ---------------------------------------------------------------------
// Onglet « Historique » (direction uniquement)
// ---------------------------------------------------------------------
async function chargerHistorique(id) {
  const [journal, noms] = await Promise.all([
    sb.from('journal').select('*').eq('enfant_id', id).order('created_at', { ascending: false }).limit(200),
    chargerNoms(),
  ]);
  const panneau = $('panneau-historique');
  if (!panneau || ficheCourante !== id) return;

  const lignes = journal.data || [];
  panneau.innerHTML = lignes.length
    ? `<ol class="chronologie">${lignes.map((l) => `
        <li class="evenement evenement-${l.action.toLowerCase()}">
          <span class="evenement-point" aria-hidden="true"></span>
          <div>
            <p><b>${esc(noms.get(l.user_id) || 'Système')}</b> · ${LIBELLES_ACTIONS[l.action] || esc(l.action)}</p>
            <p class="discret">${esc(l.detail || '')}</p>
          </div>
          <time datetime="${esc(l.created_at)}">${formaterDateHeure(l.created_at)}</time>
        </li>`).join('')}</ol>`
    : etatVide('journal', 'Aucune activité enregistrée', 'Les actions sur ce dossier apparaîtront ici.');
}
