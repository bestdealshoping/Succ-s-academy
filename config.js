// assets/js/config.js
// URL de base des Edge Functions Supabase. À ajuster si vous utilisez
// un domaine personnalisé pour vos functions.
const EDGE_FUNCTIONS_URL = "https://znromggearqrcsfqmqid.supabase.co/functions/v1";

/**
 * Appelle une Edge Function avec le JWT de l'utilisateur courant.
 */
async function callEdgeFunction(functionName, payload) {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Utilisateur non authentifié");
  }

  const response = await fetch(`${EDGE_FUNCTIONS_URL}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Erreur lors de l'appel serveur");
  }
  return data;
}
