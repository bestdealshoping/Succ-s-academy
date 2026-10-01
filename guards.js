// assets/js/guards.js
// À inclure en haut des pages protégées, après supabaseClient.js.
// Rappel : c'est une protection d'expérience utilisateur uniquement.
// La sécurité réelle est appliquée par les policies RLS et les Edge Functions.

/**
 * Redirige vers la page de connexion si l'utilisateur n'est pas authentifié.
 * Retourne le profil de l'utilisateur si tout est OK.
 */
async function requireAuth() {
  const session = await getCurrentSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return getCurrentProfile();
}

/**
 * Redirige vers le tableau de bord si l'utilisateur n'est pas admin.
 */
async function requireAdmin() {
  const profile = await requireAuth();
  if (!profile) return null;
  if (profile.role !== "admin") {
    window.location.href = "dashboard.html";
    return null;
  }
  return profile;
}
