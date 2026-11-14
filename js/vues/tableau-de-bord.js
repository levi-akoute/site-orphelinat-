// =====================================================================
// TABLEAU DE BORD (page d'accueil après connexion)
// Chiffres clés + derniers dossiers modifiés + raccourcis
// =====================================================================
import { sb } from '../config.js';
import { etat, estDirection } from '../session.js';
import { coque, chargement, remplirContenu, pastilleStatut, etatVide } from '../interface.js';
import { esc, icone, initiales, texteAge, formaterDate, nouvellePage, pageToujoursActive } from '../outils.js';

// Compte les enfants qui correspondent à un filtre, sans télécharger les fiches
// (head: true = on ne demande que le nombre, pas les lignes)
function compter(filtre) {
  return filtre(sb.from('enfants').select('id', { count: 'exact', head: true }));
}

export async function vueTableauDeBord() {
  const numero = nouvellePage();
  coque(chargement(), 'accueil');

  // 1er janvier de l'année en cours, pour les admissions de l'année
  const annee = new Date().getFullYear();
  const debutAnnee = `${annee}-01-01`;

  // Toutes les requêtes partent en même temps (plus rapide)
  const [actifs, sortis, archives, admissions, recents] = await Promise.all([
    compter((q) => q.eq('statut', 'Actif')),
    compter((q) => q.eq('statut', 'Sorti')),
    compter((q) => q.eq('statut', 'Archivé')),
    compter((q) => q.gte('date_admission', debutAnnee)),
    sb.from('enfants')
      .select('id, matricule, nom, prenoms, date_naissance, statut, updated_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(6),
  ]);

  // L'utilisateur est parti sur une autre page entre-temps : on n'affiche rien
  if (!pageToujoursActive(numero)) return;

  // Les 4 cartes de chiffres
  const chiffres = [
    { libelle: 'Enfants accueillis', valeur: actifs.count, nomIcone: 'enfant', classe: 'vert', lien: '#/dossiers/Actif' },
    { libelle: `Admissions ${annee}`, valeur: admissions.count, nomIcone: 'calendrier', classe: 'bleu', lien: '#/dossiers/' },
    { libelle: 'Sortis', valeur: sortis.count, nomIcone: 'sortie', classe: 'sable', lien: '#/dossiers/Sorti' },
    { libelle: 'Archivés', valeur: archives.count, nomIcone: 'archive', classe: 'gris', lien: `#/dossiers/${encodeURIComponent('Archivé')}` },
  ];

  // Date du jour en toutes lettres : « samedi 14 novembre 2026 »
  const dateDuJour = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Liste des derniers dossiers modifiés
  const lignesRecentes = (recents.data || []).map((e) => `
    <li><a class="ligne-lien" href="#/enfant/${e.id}">
      <span class="avatar avatar-petit">${esc(initiales(e.nom, e.prenoms))}</span>
      <span class="ligne-texte"><b>${esc(e.nom)} ${esc(e.prenoms)}</b>
        <small>${esc(e.matricule)}${e.date_naissance ? ' · ' + texteAge(e.date_naissance) : ''}</small></span>
      <small class="ligne-date">${formaterDate(e.updated_at)}</small>
      ${pastilleStatut(e.statut)}
    </a></li>`).join('');

  // Raccourcis (le journal seulement pour la direction)
  const raccourcis = [
    ['#/nouveau', 'plus', 'Ajouter un enfant', 'Créer une nouvelle fiche'],
    ['#/dossiers', 'dossiers', 'Tous les dossiers', 'Rechercher, filtrer'],
    ...(estDirection() ? [
      ['#/journal', 'journal', 'Journal d’activité', 'Qui a fait quoi, et quand'],
      ['#/equipe', 'equipe', 'Équipe', 'Comptes et rôles'],
    ] : []),
  ];

  remplirContenu(`
    <div class="entete-page">
      <div>
        <p class="sur-titre">${esc(dateDuJour)}</p>
        <h1>Bonjour${etat.moi.nom_complet ? ', ' + esc(etat.moi.nom_complet.split(' ')[0]) : ''}</h1>
      </div>
    </div>

    <div class="chiffres">
      ${chiffres.map((c) => `
        <a class="carte chiffre chiffre-${c.classe}" href="${c.lien}">
          <span class="chiffre-icone">${icone(c.nomIcone)}</span>
          <span class="chiffre-valeur">${c.valeur ?? 0}</span>
          <span class="chiffre-libelle">${c.libelle}</span>
        </a>`).join('')}
    </div>

    <div class="grille-accueil">
      <section class="carte">
        <div class="carte-tete">
          <h2>Derniers dossiers modifiés</h2>
          <a class="lien-discret" href="#/dossiers">Tout voir ${icone('chevron')}</a>
        </div>
        ${lignesRecentes
          ? `<ul class="liste-lignes">${lignesRecentes}</ul>`
          : etatVide('dossiers', 'Aucun dossier pour l’instant',
              'Commencez par créer la fiche du premier enfant.',
              '<a class="btn btn-principal" href="#/nouveau">Ajouter un enfant</a>')}
      </section>

      <section class="carte">
        <div class="carte-tete"><h2>Raccourcis</h2></div>
        <div class="raccourcis">
          ${raccourcis.map(([lien, nomIcone, titre, texte]) => `
            <a class="raccourci-carte" href="${lien}">
              <span class="raccourci-icone">${icone(nomIcone)}</span>
              <span><b>${titre}</b><small>${texte}</small></span>
            </a>`).join('')}
        </div>
      </section>
    </div>`);
}
