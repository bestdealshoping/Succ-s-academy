// assets/js/validators.js
// Validation côté client. Ces mêmes règles doivent être ré-appliquées
// côté Edge Function pour toute opération sensible (jamais faire confiance
// uniquement au client).

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !re.test(email)) {
    return "Veuillez entrer une adresse email valide.";
  }
  return null;
}

function validatePassword(password) {
  if (!password || password.length < 8) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Le mot de passe doit contenir au moins une majuscule.";
  }
  if (!/[0-9]/.test(password)) {
    return "Le mot de passe doit contenir au moins un chiffre.";
  }
  return null;
}

function validateFullName(name) {
  if (!name || name.trim().length < 2) {
    return "Veuillez entrer votre nom complet.";
  }
  return null;
}

/**
 * Affiche un message d'erreur dans un élément du DOM.
 */
function showFieldError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message || "";
    el.style.display = message ? "block" : "none";
  }
}