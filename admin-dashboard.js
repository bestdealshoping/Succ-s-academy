// assets/js/pages/admin-dashboard.js

(async function init() {
  const profile = await requireAdmin();
  if (!profile) return;
  renderAdminSidebar("dashboard", profile);
  document.getElementById("welcomeTitle").textContent = `Bonjour, ${profile.full_name.split(" ")[0]} 👋`;

  await Promise.all([loadOverview(), loadRecentActivity()]);
})();

async function loadOverview() {
  const [{ count: userCount }, { data: payments }, { count: hiddenPostsCount }, { count: pendingPayments }] =
    await Promise.all([
      supabaseClient.from("profiles").select("*", { count: "exact", head: true }),
      supabaseClient.from("payments").select("amount_usd").eq("status", "succeeded"),
      supabaseClient.from("community_posts").select("*", { count: "exact", head: true }).eq("is_hidden", true),
      supabaseClient.from("payments").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);

  const revenue = (payments || []).reduce((sum, p) => sum + Number(p.amount_usd), 0);

  document.getElementById("overviewStats").innerHTML = `
    <div class="stat-card"><div class="label">Utilisateurs</div><div class="value">${userCount ?? 0}</div></div>
    <div class="stat-card"><div class="label">Revenu total</div><div class="value">${revenue.toLocaleString("fr-FR")} $</div></div>
    <div class="stat-card"><div class="label">Posts masqués</div><div class="value">${hiddenPostsCount ?? 0}</div></div>
    <div class="stat-card"><div class="label">Paiements en attente</div><div class="value">${pendingPayments ?? 0}</div></div>
  `;

  if ((hiddenPostsCount ?? 0) > 0) {
    const notice = document.getElementById("pendingModerationNotice");
    notice.style.display = "block";
    notice.innerHTML = `${hiddenPostsCount} post(s) masqué(s) à vérifier — <a href="/admin/community.html">voir la modération</a>.`;
  }
}

async function loadRecentActivity() {
  const { data: logs, error } = await supabaseClient
    .from("admin_audit_logs")
    .select("*, profiles:admin_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(8);

  const container = document.getElementById("recentActivity");
  if (error) {
    console.error("Erreur chargement activité:", error.message);
    container.innerHTML = '<p class="loading-text">Erreur de chargement.</p>';
    return;
  }

  if (logs.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucune activité admin pour le moment.</p>';
    return;
  }

  container.innerHTML = logs
    .map(
      (l) => `
      <div class="activity-row">
        <span>${l.profiles?.full_name || "—"} — ${l.action} ${l.target_table ? `(${l.target_table})` : ""}</span>
        <span style="color:var(--color-text-muted);white-space:nowrap;">${new Date(l.created_at).toLocaleString("fr-FR")}</span>
      </div>`
    )
    .join("");
}
