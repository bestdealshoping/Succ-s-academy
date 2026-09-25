// assets/js/pages/dashboard.js

(async function init() {
  const profile = await requireAuth();
  if (!profile) return; // requireAuth a déjà redirigé si besoin

  renderSidebar("dashboard", profile);
  document.getElementById("welcomeTitle").textContent = `Bonjour, ${profile.full_name.split(" ")[0]} 👋`;

  try {
    const dashboardData = await loadDashboardData(profile.id);
    renderStats(dashboardData);
    renderLevels(dashboardData);
  } catch (err) {
    console.error("Erreur chargement dashboard:", err);
    document.getElementById("levelsContainer").innerHTML =
      '<p class="loading-text">Une erreur est survenue lors du chargement de votre progression.</p>';
  }
})();

async function loadDashboardData(userId) {
  // 1. Niveaux avec cours -> modules -> leçons imbriqués
  const { data: levels, error: levelsError } = await supabaseClient
    .from("levels")
    .select(
      `id, name, price_usd, order_index,
       courses ( id, title, order_index,
         modules ( id, lessons ( id ) )
       )`
    )
    .order("order_index");
  if (levelsError) throw levelsError;

  // 2. Leçons complétées par l'utilisateur
  const { data: progress, error: progressError } = await supabaseClient
    .from("user_lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .eq("status", "completed");
  if (progressError) throw progressError;
  const completedLessonIds = new Set(progress.map((p) => p.lesson_id));

  // 3. Paiements réussis
  const { data: payments, error: paymentsError } = await supabaseClient
    .from("payments")
    .select("level_id")
    .eq("user_id", userId)
    .eq("status", "succeeded");
  if (paymentsError) throw paymentsError;
  const paidLevelIds = new Set(payments.map((p) => p.level_id));

  // 4. Certificats déjà obtenus
  const { data: certificates, error: certificatesError } = await supabaseClient
    .from("certificates")
    .select("level_id")
    .eq("user_id", userId);
  if (certificatesError) throw certificatesError;
  const certifiedLevelIds = new Set(certificates.map((c) => c.level_id));

  return { levels, completedLessonIds, paidLevelIds, certifiedLevelIds };
}

function computeLevelProgress(level, completedLessonIds) {
  let total = 0;
  let completed = 0;
  for (const course of level.courses || []) {
    for (const module of course.modules || []) {
      for (const lesson of module.lessons || []) {
        total += 1;
        if (completedLessonIds.has(lesson.id)) completed += 1;
      }
    }
  }
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, percent };
}

function renderStats({ levels, completedLessonIds, certifiedLevelIds }) {
  let totalLessons = 0;
  let totalCompleted = 0;
  for (const level of levels) {
    const { total, completed } = computeLevelProgress(level, completedLessonIds);
    totalLessons += total;
    totalCompleted += completed;
  }
  const overallPercent = totalLessons === 0 ? 0 : Math.round((totalCompleted / totalLessons) * 100);

  const statGrid = document.getElementById("statGrid");
  statGrid.innerHTML = `
    <div class="stat-card">
      <div class="label">Progression globale</div>
      <div class="value">${overallPercent}%</div>
    </div>
    <div class="stat-card">
      <div class="label">Leçons terminées</div>
      <div class="value">${totalCompleted} / ${totalLessons}</div>
    </div>
    <div class="stat-card">
      <div class="label">Certificats obtenus</div>
      <div class="value">${certifiedLevelIds.size}</div>
    </div>
  `;
}

function renderLevels({ levels, completedLessonIds, paidLevelIds, certifiedLevelIds }) {
  const container = document.getElementById("levelsContainer");

  container.innerHTML = levels
    .map((level) => {
      const unlocked = level.price_usd == 0 || paidLevelIds.has(level.id);
      const { completed, total, percent } = computeLevelProgress(level, completedLessonIds);
      const hasCertificate = certifiedLevelIds.has(level.id);

      let badgeHtml;
      if (!unlocked) {
        badgeHtml = `<span class="badge locked">Verrouillé — ${level.price_usd} $</span>`;
      } else if (hasCertificate) {
        badgeHtml = `<span class="badge free">Certifié</span>`;
      } else if (level.price_usd == 0) {
        badgeHtml = `<span class="badge free">Gratuit</span>`;
      } else {
        badgeHtml = `<span class="badge active">Débloqué</span>`;
      }

      const actionHtml = unlocked
        ? `<a class="btn btn-sm" href="/app/academy.html?level=${level.id}">Continuer</a>`
        : `<a class="btn btn-sm" href="/app/billing.html?level=${level.id}">Débloquer</a>`;

      return `
        <div class="level-card ${unlocked ? "" : "locked"}">
          <div class="level-info" style="flex:1;">
            <h3>${level.name} ${badgeHtml}</h3>
            <p>${total} leçons · ${completed} terminées (${percent}%)</p>
            <div class="progress-bar"><div class="progress-bar-fill" style="width:${percent}%;"></div></div>
          </div>
          ${actionHtml}
        </div>
      `;
    })
    .join("");
}
