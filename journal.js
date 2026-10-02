// assets/js/pages/journal.js

(async function init() {
  const profile = await requireAuth();
  if (!profile) return;
  renderSidebar("journal", profile);

  document.getElementById("entryForm").addEventListener("submit", handleSubmit);
  await loadEntries();
})();

function showMessage(type, text) {
  const el = document.getElementById("journalMessage");
  el.className = `form-message ${type}`;
  el.textContent = text;
}

async function handleSubmit(e) {
  e.preventDefault();

  const instrument = document.getElementById("instrument").value.trim();
  const action = document.getElementById("action").value;
  const amountRaw = document.getElementById("amount").value.trim();
  const justification = document.getElementById("justification").value.trim();

  if (justification.length < 3) {
    showFieldError("justificationError", "Veuillez décrire votre raisonnement.");
    return;
  }
  showFieldError("justificationError", null);

  const submitBtn = document.getElementById("submitEntryBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Envoi...";

  try {
    await callEdgeFunction("log-journal-entry", {
      instrument,
      action,
      amount: amountRaw ? parseFloat(amountRaw) : undefined,
      justification,
    });

    document.getElementById("entryForm").reset();
    showMessage("success", "Entrée ajoutée.");
    await loadEntries();
  } catch (err) {
    console.error("Erreur ajout entrée:", err);
    showMessage("error", err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Ajouter au journal";
  }
}

async function loadEntries() {
  const session = await getCurrentSession();
  const { data: entries, error } = await supabaseClient
    .from("trading_journal_entries")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur chargement journal:", error.message);
    return;
  }

  const container = document.getElementById("entriesContainer");
  if (entries.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucune entrée pour le moment.</p>';
    return;
  }

  container.innerHTML = entries
    .map((entry) => {
      const date = new Date(entry.created_at).toLocaleString("fr-FR");
      const notes = entry.system_analysis?.notes || [];
      return `
        <div class="journal-entry">
          <div class="journal-entry-head">
            <strong>${entry.action === "buy" ? "Achat" : "Vente"} · ${entry.instrument}</strong>
            <span class="journal-entry-date">${date}</span>
          </div>
          ${entry.amount ? `<div style="font-size:13px;color:var(--color-text-muted);">Montant : ${entry.amount} $</div>` : ""}
          <p class="journal-entry-justification">${entry.justification}</p>
          ${
            entry.flagged_pattern
              ? `<div class="journal-flag">⚠ ${entry.flagged_pattern}</div>`
              : ""
          }
          ${
            notes.length > 0
              ? `<div class="journal-notes">${notes.map((n) => `• ${n}`).join("<br/>")}</div>`
              : ""
          }
        </div>`;
    })
    .join("");
}
