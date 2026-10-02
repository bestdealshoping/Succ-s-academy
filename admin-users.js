// assets/js/pages/admin-users.js

let allUsers = [];
let currentUser = null; // profil actuellement ouvert dans la modale
let adminProfile = null;

(async function init() {
  adminProfile = await requireAdmin();
  if (!adminProfile) return;
  renderAdminSidebar("users", adminProfile);

  document.getElementById("searchInput").addEventListener("input", (e) => renderUsers(e.target.value));
  document.getElementById("closeUserModalBtn").addEventListener("click", closeUserModal);
  document.getElementById("saveRoleBtn").addEventListener("click", saveRole);
  document.getElementById("resetProgressBtn").addEventListener("click", resetProgress);

  await loadUsers();
})();

function showMessage(type, text) {
  const el = document.getElementById("adminMessage");
  el.className = `form-message ${type}`;
  el.textContent = text;
}

async function loadUsers() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*, levels:current_level_id(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur chargement utilisateurs:", error.message);
    document.getElementById("usersContainer").innerHTML = '<p class="loading-text">Erreur de chargement.</p>';
    return;
  }
  allUsers = data;
  renderUsers("");
}

function renderUsers(filter) {
  const term = filter.trim().toLowerCase();
  const filtered = term
    ? allUsers.filter(
        (u) => u.full_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
      )
    : allUsers;

  const container = document.getElementById("usersContainer");
  if (filtered.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucun utilisateur trouvé.</p>';
    return;
  }

  container.innerHTML = `
    <table class="stat-table">
      <thead>
        <tr><th>Nom</th><th>Email</th><th>Niveau</th><th>Rôle</th><th>Inscrit le</th></tr>
      </thead>
      <tbody>
        ${filtered
          .map(
            (u) => `
          <tr data-user-id="${u.id}" style="cursor:pointer;">
            <td>${u.full_name}</td>
            <td>${u.email}</td>
            <td>${u.levels?.name || "—"}</td>
            <td>${u.role === "admin" ? '<span class="badge active">Admin</span>' : "Étudiant"}</td>
            <td>${new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;

  container.querySelectorAll("[data-user-id]").forEach((row) => {
    row.addEventListener("click", () => openUserModal(row.dataset.userId));
  });
}

async function openUserModal(userId) {
  currentUser = allUsers.find((u) => u.id === userId);
  if (!currentUser) return;

  document.getElementById("userModalName").textContent = currentUser.full_name;
  document.getElementById("userModalEmail").textContent = currentUser.email;
  document.getElementById("roleSelect").value = currentUser.role;

  document.getElementById("userStats").innerHTML = '<p class="loading-text">Chargement des statistiques...</p>';
  document.getElementById("userPayments").innerHTML = '<p class="loading-text">Chargement...</p>';
  document.getElementById("userModal").style.display = "flex";

  const [{ count: lessonsDone }, { count: certCount }, { data: payments }] = await Promise.all([
    supabaseClient
      .from("user_lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed"),
    supabaseClient.from("certificates").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabaseClient
      .from("payments")
      .select("amount_usd, status, created_at, levels(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  document.getElementById("userStats").innerHTML = `
    Leçons terminées : <strong>${lessonsDone ?? 0}</strong> · Certificats obtenus : <strong>${certCount ?? 0}</strong>
  `;

  document.getElementById("userPayments").innerHTML =
    payments && payments.length > 0
      ? payments
          .map(
            (p) =>
              `<div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--color-border);">
                ${p.levels?.name || "Niveau"} — ${p.amount_usd} $ — ${p.status} — ${new Date(p.created_at).toLocaleDateString("fr-FR")}
              </div>`
          )
          .join("")
      : '<p class="loading-text">Aucun paiement.</p>';
}

function closeUserModal() {
  document.getElementById("userModal").style.display = "none";
  currentUser = null;
}

async function logAdminAction(action, targetTable, targetId, details) {
  await supabaseClient.from("admin_audit_logs").insert({
    admin_id: adminProfile.id,
    action,
    target_table: targetTable,
    target_id: targetId,
    details,
  });
}

async function saveRole() {
  if (!currentUser) return;
  const newRole = document.getElementById("roleSelect").value;
  const saveBtn = document.getElementById("saveRoleBtn");
  saveBtn.disabled = true;

  const { error } = await supabaseClient.from("profiles").update({ role: newRole }).eq("id", currentUser.id);

  if (error) {
    showMessage("error", "Erreur : " + error.message);
  } else {
    await logAdminAction("role_change", "profiles", currentUser.id, {
      from: currentUser.role,
      to: newRole,
    });
    showMessage("success", `Rôle mis à jour pour ${currentUser.full_name}.`);
    closeUserModal();
    await loadUsers();
  }
  saveBtn.disabled = false;
}

async function resetProgress() {
  if (!currentUser) return;
  if (
    !confirm(
      `Réinitialiser TOUTE la progression académique de ${currentUser.full_name} (leçons, quiz, certificats) ? Cette action est irréversible.`
    )
  )
    return;

  const resetBtn = document.getElementById("resetProgressBtn");
  resetBtn.disabled = true;
  resetBtn.textContent = "Réinitialisation...";

  try {
    const userId = currentUser.id;

    const { error: progressError } = await supabaseClient
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", userId);
    if (progressError) throw progressError;

    // La suppression des tentatives de quiz entraîne celle de leurs réponses (ON DELETE CASCADE)
    const { error: attemptsError } = await supabaseClient.from("quiz_attempts").delete().eq("user_id", userId);
    if (attemptsError) throw attemptsError;

    const { error: certsError } = await supabaseClient.from("certificates").delete().eq("user_id", userId);
    if (certsError) throw certsError;

    const beginnerLevel = allUsers.length > 0 ? null : null; // calculé ci-dessous
    const { data: beginner } = await supabaseClient.from("levels").select("id").eq("order_index", 1).single();
    await supabaseClient.from("profiles").update({ current_level_id: beginner?.id || null }).eq("id", userId);

    await logAdminAction("progress_reset", "profiles", userId, { reset_by: adminProfile.full_name });

    showMessage("success", `Progression de ${currentUser.full_name} réinitialisée.`);
    closeUserModal();
    await loadUsers();
  } catch (err) {
    console.error("Erreur réinitialisation:", err);
    showMessage("error", "Erreur : " + err.message);
  } finally {
    resetBtn.disabled = false;
    resetBtn.textContent = "Réinitialiser la progression";
  }
}
