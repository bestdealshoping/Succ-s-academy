// assets/js/pages/billing.js

(async function init() {
  const profile = await requireAuth();
  if (!profile) return;
  renderSidebar("billing", profile);

  const params = new URLSearchParams(window.location.search);
  const highlightLevelId = params.get("level");

  // Message post-paiement (redirection Stripe success_url / cancel_url)
  const statusParam = params.get("status");
  if (statusParam === "success") {
    showMessage(
      "success",
      "Paiement en cours de confirmation. Votre niveau sera débloqué dès que Stripe aura validé la transaction (quelques secondes)."
    );
  } else if (statusParam === "cancelled") {
    showMessage("error", "Paiement annulé.");
  }

  try {
    await loadLevels(profile.id, highlightLevelId);
    await loadHistory(profile.id);
  } catch (err) {
    console.error("Erreur chargement facturation:", err);
    showMessage("error", "Une erreur est survenue lors du chargement.");
  }
})();

function showMessage(type, text) {
  const el = document.getElementById("billingMessage");
  el.className = `form-message ${type}`;
  el.textContent = text;
}

async function loadLevels(userId, highlightLevelId) {
  const { data: levels, error } = await supabaseClient.from("levels").select("*").order("order_index");
  if (error) throw error;

  const { data: payments, error: paymentsError } = await supabaseClient
    .from("payments")
    .select("level_id, status")
    .eq("user_id", userId)
    .eq("status", "succeeded");
  if (paymentsError) throw paymentsError;
  const unlockedLevelIds = new Set(payments.map((p) => p.level_id));

  const container = document.getElementById("levelsContainer");
  container.innerHTML = levels
    .map((level) => {
      const isFree = level.price_usd == 0;
      const isUnlocked = isFree || unlockedLevelIds.has(level.id);
      const highlight = level.id === highlightLevelId ? "border-color:var(--color-primary);" : "";

      let actionHtml;
      if (isUnlocked) {
        actionHtml = `<span class="badge free">Déjà débloqué</span>`;
      } else {
        actionHtml = `<button class="btn btn-sm" data-level-id="${level.id}" data-buy-btn>Payer ${level.price_usd} $</button>`;
      }

      return `
        <div class="level-card" style="${highlight}">
          <div class="level-info">
            <h3>${level.name}</h3>
            <p>${isFree ? "Gratuit" : `${level.price_usd} $ — accès permanent`}</p>
          </div>
          ${actionHtml}
        </div>`;
    })
    .join("");

  container.querySelectorAll("[data-buy-btn]").forEach((btn) => {
    btn.addEventListener("click", () => startCheckout(btn.dataset.levelId, btn));
  });
}

async function startCheckout(levelId, btnEl) {
  btnEl.disabled = true;
  btnEl.textContent = "Redirection...";
  try {
    const { checkout_url } = await callEdgeFunction("create-checkout-session", { level_id: levelId });
    window.location.href = checkout_url;
  } catch (err) {
    console.error("Erreur création session de paiement:", err);
    showMessage("error", err.message);
    btnEl.disabled = false;
    btnEl.textContent = "Réessayer";
  }
}

async function loadHistory(userId) {
  const { data: payments, error } = await supabaseClient
    .from("payments")
    .select("id, amount_usd, status, paid_at, created_at, levels(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const container = document.getElementById("historyContainer");
  if (payments.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucun paiement pour le moment.</p>';
    return;
  }

  const statusLabels = {
    succeeded: '<span class="badge free">Réussi</span>',
    pending: '<span class="badge locked">En attente</span>',
    failed: '<span class="badge locked" style="background:rgba(239,68,68,.15);color:#fca5a5;">Échoué</span>',
    refunded: '<span class="badge locked">Remboursé</span>',
  };

  container.innerHTML = payments
    .map(
      (p) => `
      <div class="level-card">
        <div class="level-info">
          <h3>${p.levels ? p.levels.name : "Niveau"}</h3>
          <p>${p.amount_usd} $ — ${new Date(p.created_at).toLocaleDateString("fr-FR")}</p>
        </div>
        ${statusLabels[p.status] || p.status}
      </div>`
    )
    .join("");
}
