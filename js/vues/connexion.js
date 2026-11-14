// =====================================================================
// PAGES DE CONNEXION
//   - vueConnexion : formulaire e-mail + mot de passe
//   - vueAttente   : compte connecté mais pas encore activé
// =====================================================================
import { sb } from '../config.js';
import { chargerProfil, deconnexion } from '../session.js';
import { $, icone, allerA } from '../outils.js';

// Panneau de gauche commun aux deux pages (logo + nom + devise)
const PANNEAU_MARQUE = `
  <aside class="connexion-marque">
    <img src="assets/logo-clair-512.webp" alt="Logo de l’orphelinat Emmanuel" width="260" height="250">
    <div>
      <h1>Orphelinat Emmanuel</h1>
      <p>Un foyer, une famille, un avenir.</p>
    </div>
  </aside>`;

export function vueConnexion() {
  $('app').innerHTML = `
  <div class="connexion">
    ${PANNEAU_MARQUE}
    <section class="connexion-zone">
      <form class="connexion-formulaire" id="formulaire-connexion">
        <div>
          <h2>Connexion</h2>
          <p class="discret">Espace réservé au personnel autorisé.</p>
        </div>
        <label>Adresse e-mail
          <input type="email" name="email" required autocomplete="username" autofocus>
        </label>
        <label>Mot de passe
          <input type="password" name="password" required autocomplete="current-password">
        </label>
        <p class="message-erreur" id="erreur-connexion" role="alert" hidden></p>
        <button class="btn btn-principal btn-large" id="bouton-connexion">Se connecter</button>
        <details class="aide">
          <summary>Mot de passe oublié ?</summary>
          <p>Contactez la direction ou le responsable technique : il peut réinitialiser votre accès.
          Une fois connecté, vous pourrez changer votre mot de passe dans « Mon compte ».</p>
        </details>
      </form>
      <p class="connexion-note">${icone('bouclier')}Les consultations et modifications des dossiers sont enregistrées.</p>
    </section>
  </div>`;

  $('formulaire-connexion').onsubmit = async (e) => {
    e.preventDefault();
    const champs = new FormData(e.target);
    const bouton = $('bouton-connexion');
    const erreur = $('erreur-connexion');

    // Pendant l'attente : bouton bloqué et texte qui change
    bouton.disabled = true;
    bouton.textContent = 'Connexion…';
    erreur.hidden = true;

    const { error } = await sb.auth.signInWithPassword({
      email: champs.get('email').trim(),
      password: champs.get('password'),
    });

    if (error) {
      // Message volontairement vague : on ne dit pas si c'est l'e-mail ou le mot de passe
      erreur.textContent = error.message.includes('fetch')
        ? 'Connexion internet indisponible.'
        : 'E-mail ou mot de passe incorrect.';
      erreur.hidden = false;
      bouton.disabled = false;
      bouton.textContent = 'Se connecter';
      return;
    }

    // Connexion réussie : on charge le profil puis on réaffiche la page demandée
    await chargerProfil();
    allerA(location.hash || '#/');
  };
}

export function vueAttente() {
  $('app').innerHTML = `
  <div class="connexion">
    ${PANNEAU_MARQUE}
    <section class="connexion-zone">
      <div class="connexion-formulaire">
        <span class="pastille-icone">${icone('bouclier')}</span>
        <h2>Accès en attente</h2>
        <p class="discret">Votre compte n’est pas encore activé, ou votre rôle ne donne pas accès aux dossiers.
        Contactez la direction pour qu’elle active votre compte.</p>
        <button class="btn btn-secondaire" id="bouton-sortir">${icone('deconnexion')}Se déconnecter</button>
      </div>
    </section>
  </div>`;
  $('bouton-sortir').onclick = () => deconnexion();
}
