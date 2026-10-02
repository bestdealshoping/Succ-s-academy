// assets/js/pages/admin-audit-logs.js

let allLogs = [];

(async function init() {
  const profile = await requireAdmin();
  if (!profile) return;
  renderAdminSidebar("audit-logs", profile);

  document.getElementById("searchInput").addEventListener("input", (e) => renderLogs(e.target.value));

  await loadLogs();
})();

async function loadLogs() {
  const { data, error } = await supabaseClient
    .from("admin_audit_logs")
    .select("*, profiles:admin_id(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Erreur chargement logs:", error.message);
    document.getElementById("logsContainer").innerHTML = '<p class="loading-text">Erreur de chargement.</p>';
    return;
  }
  allLogs = data;
  renderLogs("");
}

function renderLogs(filter) {
  const term = filter.trim().toLowerCase();
  const filtered = term
    ? allLogs.filter(
        (l) =>
          l.action.toLowerCase().includes(term) ||
          (l.profiles?.full_name || "").toLowerCase().includes(term) ||
          (l.target_table || "").toLowerCase().includes(term)
      )
    : allLogs;

  const container = document.getElementById("logsContainer");
  if (filtered.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucun log trouvé.</p>';
    return;
  }

  container.innerHTML = `
    <table class="stat-table">
      <thead><tr><th>Date</th><th>Admin</th><th>Action</th><th>Table</th><th>Détails</th></tr></thead>
      <tbody>
        ${filtered
          .map(
            (l) => `
          <tr>
            <td style="white-space:nowrap;">${new Date(l.created_at).toLocaleString("fr-FR")}</td>
            <td>${l.profiles?.full_name || "—"}</td>
            <td>${l.action}</td>
            <td>${l.target_table || "—"}</td>
            <td style="font-size:12px;color:var(--color-text-muted);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${l.details ? JSON.stringify(l.details) : ""}
            </td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
} 
