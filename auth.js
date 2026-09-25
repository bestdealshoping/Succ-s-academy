// assets/js/auth.js
// Nécessite supabaseClient.js et validators.js chargés avant ce script.

/**
 * Inscription : crée le compte Supabase Auth puis le profil applicatif.
 */
async function signUp({ fullName, email, password }) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }, // dispo dans auth.users.raw_user_meta_data
    },
  });

  if (error) {
    return { success: false, message: translateAuthError(error) };
  }

  const user = data.user;
  if (!user) {
    // Cas où la confirmation par email est requise avant que la session existe.
    return {
      success: true,
      needsEmailConfirmation: true,
      message: "Compte créé. Vérifiez votre email pour confirmer votre inscription.",
    };
  }

  // Récupère le niveau "Débutant" (order_index = 1) pour l'assigner par défaut.
  const { data: beginnerLevel } = await supabaseClient
    .from("levels")
    .select("id")
    .eq("order_index", 1)
    .single();

  const { error: profileError } = await supabaseClient.from("profiles").insert({
    id: user.id,
    full_name: fullName,
    email,
    role: "student",
    current_level_id: beginnerLevel ? beginnerLevel.id : null,
  });

  if (profileError) {
    console.error("Erreur création profil:", profileError.message);
    return {
      success: false,
      message: "Compte créé mais échec de la création du profil. Contactez le support.",
    };
  }

  return { success: true, needsEmailConfirmation: !data.session };
}

/**
 * Connexion par email + mot de passe.
 */
async function signIn({ email, password }) {
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    return { success: false, message: translateAuthError(error) };
  }
  return { success: true };
}

/**
 * Envoie un email de réinitialisation de mot de passe.
 */
async function requestPasswordReset(email) {
  const redirectTo = `${window.location.origin}/auth/update-password.html`;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    return { success: false, message: translateAuthError(error) };
  }
  return { success: true, message: "Email de réinitialisation envoyé si ce compte existe." };
}

/**
 * Met à jour le mot de passe (depuis le lien reçu par email).
 */
async function updatePassword(newPassword) {
  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
  if (error) {
    return { success: false, message: translateAuthError(error) };
  }
  return { success: true, message: "Mot de passe mis à jour." };
}

async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.href = "/auth/login.html";
}

function translateAuthError(error) {
  const msg = (error && error.message) || "";
  if (msg.includes("Invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (msg.includes("User already registered")) {
    return "Un compte existe déjà avec cet email.";
  }
  if (msg.includes("Password should be at least")) {
    return "Le mot de passe est trop court.";
  }
  return "Une erreur est survenue. Veuillez réessayer.";
}
