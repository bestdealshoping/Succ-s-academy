// assets/js/pages/admin-community.js

let activeFilter = "hidden";
let adminProfile = null;

(async function init() {
  adminProfile = await requireAdmin();
  if (!adminProfile) return;
  renderAdminSidebar("community", adminProfile);

  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll(".level-tab").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      loadPosts();
    });
  });

  await Promise.all([loadPosts(), loadLogs()]);
})();

function showMessage(type, text) {
  const el = document.getElementById("adminMessage");
  el.className = `form-message ${type}`;
  el.textContent = text;
}

async function loadPosts() {
  const container = document.getElementById("postsContainer");
  container.innerHTML = '<p class="loading-text">Chargement...</p>';

  let query = supabaseClient
    .from("community_posts")
    .select("*, profiles(full_name, email), community_categories(name)")
    .order("created_at", { ascending: false });

  if (activeFilter === "hidden") query = query.eq("is_hidden", true);

  const { data: posts, error } = await query;
  if (error) {
    console.error("Erreur chargement posts:", error.message);
    container.innerHTML = '<p class="loading-text">Erreur de chargement.</p>';
    return;
  }

  if (posts.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucun post à afficher.</p>';
    return;
  }

  container.innerHTML = posts
    .map(
      (p) => `
      <div class="post-row" style="cursor:default;">
        <h3>${p.title} ${p.is_hidden ? '<span style="font-size:11px;color:var(--color-danger);">(masqué)</span>' : ""}</h3>
        <p style="white-space:normal;">${p.content}</p>
        <div class="post-meta">
          ${p.profiles?.full_name || "Utilisateur"} (${p.profiles?.email || ""}) ·
          ${p.community_categories?.name || ""} · ${new Date(p.created_at).toLocaleDateString("fr-FR")}
        </div>
        <div style="margin-top:8px;">
          <button class="icon-btn" data-toggle-post="${p.id}" data-hidden="${p.is_hidden}">
            ${p.is_hidden ? "Réafficher" : "Masquer"}
          </button>
        </div>
      </div>`
    )
    .join("");

  container.querySelectorAll("[data-toggle-post]").forEach((btn) => {
    btn.addEventListener("click", () => togglePost(btn.dataset.togglePost, btn.dataset.hidden === "true"));
  });
}

async function togglePost(postId, currentlyHidden) {
  const newHidden = !currentlyHidden;
  const { error } = await supabaseClient
    .from("community_posts")
    .update({ is_hidden: newHidden })
    .eq("id", postId);

  if (error) {
    showMessage("error", "Erreur : " + error.message);
    return;
  }

  await supabaseClient.from("moderation_logs").insert({
    target_type: "post",
    target_id: postId,
    moderator_id: adminProfile.id,
    action: newHidden ? "hidden" : "restored",
    reason: "Action manuelle de l'administrateur",
  });

  showMessage("success", newHidden ? "Post masqué." : "Post réaffiché.");
  await Promise.all([loadPosts(), loadLogs()]);
}

async function loadLogs() {
  const container = document.getElementById("logsContainer");
  const { data: logs, error } = await supabaseClient
    .from("moderation_logs")
    .select("*, profiles:moderator_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Erreur chargement logs modération:", error.message);
    container.innerHTML = '<p class="loading-text">Erreur de chargement.</p>';
    return;
  }

  if (logs.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucune action de modération pour le moment.</p>';
    return;
  }

  container.innerHTML = `
    <table class="stat-table">
      <thead><tr><th>Cible</th><th>Action</th><th>Par</th><th>Raison</th><th>Date</th></tr></thead>
      <tbody>
        ${logs
          .map(
            (l) => `
          <tr>
            <td>${l.target_type}</td>
            <td>${l.action}</td>
            <td>${l.profiles?.full_name || "Automatique"}</td>
            <td style="font-size:12px;color:var(--color-text-muted);">${l.reason || ""}</td>
            <td>${new Date(l.created_at).toLocaleDateString("fr-FR")}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}
