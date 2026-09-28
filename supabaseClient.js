// assets/js/supabaseClient.js
// Client Supabase partagé par toutes les pages du site.
// Charger ce script APRÈS le CDN Supabase :
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const SUPABASE_URL ="https://jywtzplswdquybuxgcfz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY ="sb_publishable_WaHUONqb4DJzP08CCxuXFg_-piIfF9N";

// La clé publishable/anon est prévue pour être exposée côté client :
// toute la sécurité réelle repose sur les policies RLS côté base de données.
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

/**
 * Récupère la session courante (ou null si non connecté).
 */
async function getCurrentSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Erreur récupération session:", error.message);
    return null;
  }
  return data.session;
}

/**
 * Récupère le profil (table `profiles`) de l'utilisateur connecté.
 */
async function getCurrentProfile() {
  const session = await getCurrentSession();
  if (!session) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error) {
    console.error("Erreur récupération profil:", error.message);
    return null;
  }
  return data;
}


