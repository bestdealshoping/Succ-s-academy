// assets/js/pages/certificates.js

(async function init() {
  const profile = await requireAuth();
  if (!profile) return;
  renderSidebar("certificates", profile);

  try {
    await loadLevels(profile.id);
  } catch (err) {
    console.error("Erreur chargement certificats:", err);
    showMessage("error", "Une erreur est survenue lors du chargement.");
  }
})();

function showMessage(type, text) {
  const el = document.getElementById("certMessage");
  el.className = `form-message ${type}`;
  el.textContent = text;
}

async function loadLevels(userId) {
  const { data: levels, error } = await supabaseClient.from("levels").select("*").order("order_index");
  if (error) throw error;

  const { data: certificates, error: certError } = await supabaseClient
    .from("certificates")
    .select("level_id, certificate_number, issued_at")
    .eq("user_id", userId);
  if (certError) throw certError;
  const certByLevel = {};
  certificates.forEach((c) => (certByLevel[c.level_id] = c));

  const container = document.getElementById("levelsContainer");
  container.innerHTML = levels
    .map((level) => {
      const cert = certByLevel[level.id];
      return `
        <div class="level-card" id="level-row-${level.id}">
          <div class="level-info">
            <h3>${level.name}</h3>
            <p id="level-status-${level.id}">
              ${cert ? `Délivré le ${new Date(cert.issued_at).toLocaleDateString("fr-FR")} — ${cert.certificate_number}` : "Pas encore obtenu"}
            </p>
          </div>
          <button class="btn btn-sm" data-level-id="${level.id}" data-cert-btn>
            ${cert ? "Télécharger" : "Générer mon certificat"}
          </button>
        </div>`;
    })
    .join("");

  container.querySelectorAll("[data-cert-btn]").forEach((btn) => {
    btn.addEventListener("click", () => requestCertificate(btn.dataset.levelId, btn));
  });
}

async function requestCertificate(levelId, btnEl) {
  btnEl.disabled = true;
  const originalLabel = btnEl.textContent;
  btnEl.textContent = "...";

  try {
    const result = await callEdgeFunction("generate-certificate", { level_id: levelId });

    if (result.download_url) {
      window.open(result.download_url, "_blank");
    }

    const statusEl = document.getElementById(`level-status-${levelId}`);
    if (statusEl && !result.already_issued) {
      statusEl.textContent = `Délivré aujourd'hui — ${result.certificate_number}`;
    }
    btnEl.textContent = "Télécharger";
    btnEl.disabled = false;
  } catch (err) {
    console.error("Erreur génération certificat:", err);
    showMessage("error", err.message);
    btnEl.textContent = originalLabel;
    btnEl.disabled = false;
  }
}
