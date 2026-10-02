// assets/js/pages/admin-stats.js

(async function init() {
  const profile = await requireAdmin();
  if (!profile) return;
  renderAdminSidebar("stats", profile);

  await Promise.all([loadGlobalStats(), loadLevelStats(), loadQuizStats()]);
})();

async function loadGlobalStats() {
  const [{ count: userCount }, { data: payments }, { count: certCount }] = await Promise.all([
    supabaseClient.from("profiles").select("*", { count: "exact", head: true }),
    supabaseClient.from("payments").select("amount_usd").eq("status", "succeeded"),
    supabaseClient.from("certificates").select("*", { count: "exact", head: true }),
  ]);

  const revenue = (payments || []).reduce((sum, p) => sum + Number(p.amount_usd), 0);

  // "Actifs" approximé par au moins une leçon terminée au cours des 30 derniers jours.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentProgress } = await supabaseClient
    .from("user_lesson_progress")
    .select("user_id")
    .gte("completed_at", thirtyDaysAgo);
  const activeUsers = new Set((recentProgress || []).map((p) => p.user_id)).size;

  document.getElementById("globalStats").innerHTML = `
    <div class="stat-card"><div class="label">Utilisateurs totaux</div><div class="value">${userCount ?? 0}</div></div>
    <div class="stat-card"><div class="label">Actifs (30 derniers jours)</div><div class="value">${activeUsers}</div></div>
    <div class="stat-card"><div class="label">Revenu total</div><div class="value">${revenue.toLocaleString("fr-FR")} $</div></div>
    <div class="stat-card"><div class="label">Certificats délivrés</div><div class="value">${certCount ?? 0}</div></div>
  `;
}

async function loadLevelStats() {
  const { data: levels, error } = await supabaseClient
    .from("levels")
    .select("id, name, order_index, courses(modules(lessons(id)))")
    .order("order_index");
  if (error) {
    console.error("Erreur chargement niveaux:", error.message);
    return;
  }

  const { data: allProgress } = await supabaseClient
    .from("user_lesson_progress")
    .select("lesson_id")
    .eq("status", "completed");
  const completionCountByLesson = {};
  (allProgress || []).forEach((p) => {
    completionCountByLesson[p.lesson_id] = (completionCountByLesson[p.lesson_id] || 0) + 1;
  });

  const { count: totalUsers } = await supabaseClient.from("profiles").select("*", { count: "exact", head: true });

  const container = document.getElementById("levelStatsContainer");
  container.innerHTML = `
    <table class="stat-table">
      <thead><tr><th>Niveau</th><th>Leçons</th><th>Complétions moyennes</th><th>Taux d'achèvement estimé</th></tr></thead>
      <tbody>
        ${levels
          .map((level) => {
            const lessonIds = level.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id)));
            const totalCompletions = lessonIds.reduce((sum, id) => sum + (completionCountByLesson[id] || 0), 0);
            const avgPerUser = totalUsers > 0 && lessonIds.length > 0 ? totalCompletions / (totalUsers * lessonIds.length) : 0;
            return `
              <tr>
                <td>${level.name}</td>
                <td>${lessonIds.length}</td>
                <td>${totalCompletions}</td>
                <td>${Math.round(avgPerUser * 100)}%</td>
              </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;
}

async function loadQuizStats() {
  const { data: quizzes, error } = await supabaseClient
    .from("quizzes")
    .select("id, title, courses(title, levels(name))");
  if (error) {
    console.error("Erreur chargement quiz:", error.message);
    return;
  }

  const container = document.getElementById("quizStatsContainer");
  if (quizzes.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucun quiz créé pour le moment.</p>';
    return;
  }

  const rows = await Promise.all(
    quizzes.map(async (quiz) => {
      const { data: attempts } = await supabaseClient
        .from("quiz_attempts")
        .select("passed")
        .eq("quiz_id", quiz.id);
      const total = attempts?.length || 0;
      const passed = (attempts || []).filter((a) => a.passed).length;
      const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
      return { quiz, total, passed, rate };
    })
  );

  container.innerHTML = `
    <table class="stat-table">
      <thead><tr><th>Quiz</th><th>Niveau</th><th>Tentatives</th><th>Taux de réussite</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${r.quiz.title || r.quiz.courses?.title}</td>
            <td>${r.quiz.courses?.levels?.name || "—"}</td>
            <td>${r.total}</td>
            <td>${r.total > 0 ? r.rate + "%" : "—"}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}
