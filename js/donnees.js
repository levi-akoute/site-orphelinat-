// =====================================================================
// DONNÉES : requêtes vers la base utilisées par plusieurs pages
// =====================================================================
import { sb } from './config.js';

// Recherche d'enfants par matricule, nom ou prénoms (insensible à la casse)
export async function rechercherEnfants(texte, limite = 8) {
  // On retire les caractères qui ont un sens spécial dans le filtre Supabase
  // (virgule, parenthèses, guillemets…) pour que la recherche ne casse pas.
  const propre = texte.replace(/[%,()*"\\:]/g, ' ').trim();
  if (propre.length < 2) return [];
  const { data } = await sb
    .from('enfants')
    .select('id, matricule, nom, prenoms, date_naissance, statut')
    .or(`matricule.ilike.%${propre}%,nom.ilike.%${propre}%,prenoms.ilike.%${propre}%`)
    .order('nom')
    .limit(limite);
  return data || [];
}

// Table de correspondance id → nom affiché, pour le journal.
// Seule la direction peut lire tous les profils (règle RLS « p_sel »).
export async function chargerNoms() {
  const { data } = await sb.from('profiles').select('id, nom_complet, email');
  const noms = new Map();
  (data || []).forEach((p) => noms.set(p.id, p.nom_complet || p.email || 'Compte sans nom'));
  return noms;
}

// Libellés lisibles des actions du journal
export const LIBELLES_ACTIONS = {
  INSERT: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  CONSULTATION: 'Consultation',
};
