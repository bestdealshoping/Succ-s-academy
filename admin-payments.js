// assets/js/pages/admin-payments.js

let allPayments = [];
let activeStatus = "all";
let adminProfile = null;

(async function init() {
  adminProfile = await requireAdmin();
  if (!adminProfile) return;
  renderAdminSidebar("payments", adminProfile);

  document.querySelectorAll("[data-status]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeStatus = btn.dataset.status;
      document.querySelectorAll(".level-tab").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      renderPayments();
    });
  });

  await loadPayments();
})();

function showMessage(type, text) {
  const el = document.getElementById("adminMessage");
  el.className = `form-message ${type}`;
  el.textContent = text;
}

async function loadPayments() {
  const { data, error } = await supabaseClient
    .from("payments")
    .select("*, profiles(full_name, email), levels(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur chargement paiements:", error.message);
    document.getElementById("paymentsContainer").innerHTML = '<p class="loading-text">Erreur de chargement.</p>';
    return;
  }
  allPayments = data;
  renderRevenueStats();
  renderPayments();
}

function renderRevenueStats() {
  const succeeded = allPayments.filter((p) => p.status === "succeeded");
  const totalRevenue = succeeded.reduce((sum, p) => sum + Number(p.amount_usd), 0);
  const refunded = allPayments.filter((p) => p.status === "refunded").length;
  const pending = allPayments.filter((p) => p.status === "pending").length;

  document.getElementById("revenueStats").innerHTML = `
    <div class="stat-card">
      <div class="label">Revenu total</div>
      <div class="value">${totalRevenue.toLocaleString("fr-FR")} $</div>
    </div>
    <div class="stat-card">
      <div class="label">Transactions réussies</div>
      <div class="value">${succeeded.length}</div>
    </div>
    <div class="stat-card">
      <div class="label">En attente</div>
      <div class="value">${pending}</div>
    </div>
    <div class="stat-card">
      <div class="label">Remboursés</div>
      <div class="value">${refunded}</div>
    </div>
  `;
}

function renderPayments() {
  const filtered = activeStatus === "all" ? allPayments : allPayments.filter((p) => p.status === activeStatus);
  const container = document.getElementById("paymentsContainer");

  if (filtered.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucun paiement dans cette catégorie.</p>';
    return;
  }

  const statusBadge = {
    succeeded: '<span class="badge free">Réussi</span>',
    pending: '<span class="badge locked">En attente</span>',
    failed: '<span class="badge locked" style="background:rgba(239,68,68,.15);color:#fca5a5;">Échoué</span>',
    refunded: '<span class="badge locked">Remboursé</span>',
  };

  container.innerHTML = `
    <table class="stat-table">
      <thead>
        <tr><th>Utilisateur</th><th>Niveau</th><th>Montant</th><th>Statut</th><th>Date</th><th></th></tr>
      </thead>
      <tbody>
        ${filtered
          .map(
            (p) => `
          <tr>
            <td>${p.profiles?.full_name || "—"}<br/><span style="font-size:12px;color:var(--color-text-muted);">${p.profiles?.email || ""}</span></td>
            <td>${p.levels?.name || "—"}</td>
            <td>${p.amount_usd} $</td>
            <td>${statusBadge[p.status] || p.status}</td>
            <td>${new Date(p.created_at).toLocaleDateString("fr-FR")}</td>
            <td>${
              p.status === "succeeded"
                ? `<button class="icon-btn" data-refund-id="${p.id}">Marquer remboursé</button>`
                : ""
            }</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;

  container.querySelectorAll("[data-refund-id]").forEach((btn) => {
    btn.addEventListener("click", () => markRefunded(btn.dataset.refundId, btn));
  });
}

async function markRefunded(paymentId, btn) {
  if (!confirm("Marquer ce paiement comme remboursé ? Cela ne déclenche PAS de remboursement réel sur Stripe — à faire séparément si nécessaire.")) {
    return;
  }
  btn.disabled = true;

  const { error } = await supabaseClient.from("payments").update({ status: "refunded" }).eq("id", paymentId);
  if (error) {
    showMessage("error", "Erreur : " + error.message);
    btn.disabled = false;
    return;
  }

  await supabaseClient.from("admin_audit_logs").insert({
    admin_id: adminProfile.id,
    action: "payment_marked_refunded",
    target_table: "payments",
    target_id: paymentId,
  });

  showMessage("success", "Paiement marqué comme remboursé.");
  await loadPayments();
}
