// assets/js/pages/academy.js

(async function init() {
  const profile = await requireAuth();
  if (!profile) return;
  renderSidebar("academy", profile);

  const params = new URLSearchParams(window.location.search);
  const levelId = params.get("level");

  if (!levelId) {
    document.getElementById("coursesContainer").innerHTML =
      '<p class="loading-text">Aucun niveau sélectionné. Retournez au <a href="/app/dashboard.html">tableau de bord</a>.</p>';
    return;
  }

  try {
    const data = await loadAcademyData(profile.id, levelId);
    if (!data.unlocked) {
      document.getElementById("lockedNotice").style.display = "block";
      document.getElementById("unlockLink").href = `/app/billing.html?level=${levelId}`;
      document.getElementById("coursesContainer").innerHTML = "";
      document.getElementById("levelTitle").textContent = data.level.name;
      return;
    }
    document.getElementById("levelTitle").textContent = data.level.name;
    renderCourses(data);
  } catch (err) {
    console.error("Erreur chargement académie:", err);
    document.getElementById("coursesContainer").innerHTML =
      '<p class="loading-text">Une erreur est survenue lors du chargement du contenu.</p>';
  }
})();

async function loadAcademyData(userId, levelId) {
  const { data: level, error: levelError } = await supabaseClient
    .from("levels")
    .select(
      `id, name, price_usd,
       courses ( id, title, description, order_index,
         modules ( id, title, order_index,
           lessons ( id, title, order_index )
         )
       )`
    )
    .eq("id", levelId)
    .single();
  if (levelError) throw levelError;

  level.courses = (level.courses || []).sort((a, b) => a.order_index - b.order_index);
  for (const course of level.courses) {
    course.modules = (course.modules || []).sort((a, b) => a.order_index - b.order_index);
    for (const module of course.modules) {
      module.lessons = (module.lessons || []).sort((a, b) => a.order_index - b.order_index);
    }
  }

  let unlocked = level.price_usd == 0;
  if (!unlocked) {
    const { data: payment } = await supabaseClient
      .from("payments")
      .select("id")
      .eq("user_id", userId)
      .eq("level_id", levelId)
      .eq("status", "succeeded")
      .maybeSingle();
    unlocked = !!payment;
  }
  if (!unlocked) return { level, unlocked: false };

  const { data: progress, error: progressError } = await supabaseClient
    .from("user_lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .eq("status", "completed");
  if (progressError) throw progressError;
  const completedLessonIds = new Set(progress.map((p) => p.lesson_id));

  // Un quiz par cours : on récupère la meilleure tentative réussie (s'il y en a une).
  const courseIds = level.courses.map((c) => c.id);
  const { data: quizzes, error: quizzesError } = await supabaseClient
    .from("quizzes")
    .select("id, course_id")
    .in("course_id", courseIds);
  if (quizzesError) throw quizzesError;

  const quizIdByCourse = {};
  quizzes.forEach((q) => (quizIdByCourse[q.course_id] = q.id));

  const quizIds = quizzes.map((q) => q.id);
  let passedQuizIds = new Set();
  if (quizIds.length > 0) {
    const { data: attempts, error: attemptsError } = await supabaseClient
      .from("quiz_attempts")
      .select("quiz_id, passed")
      .eq("user_id", userId)
      .in("quiz_id", quizIds)
      .eq("passed", true);
    if (attemptsError) throw attemptsError;
    passedQuizIds = new Set(attempts.map((a) => a.quiz_id));
  }

  return { level, unlocked: true, completedLessonIds, quizIdByCourse, passedQuizIds };
}

function renderCourses({ level, completedLessonIds, quizIdByCourse, passedQuizIds }) {
  const container = document.getElementById("coursesContainer");

  container.innerHTML = level.courses
    .map((course) => {
      const allLessons = course.modules.flatMap((m) => m.lessons);
      const completedCount = allLessons.filter((l) => completedLessonIds.has(l.id)).length;
      const allLessonsDone = allLessons.length > 0 && completedCount === allLessons.length;

      const quizId = quizIdByCourse[course.id];
      const quizPassed = quizId && passedQuizIds.has(quizId);

      const modulesHtml = course.modules
        .map(
          (module) => `
        <div class="module-block">
          <h3>${module.title}</h3>
          <ul class="lesson-list">
            ${module.lessons
              .map((lesson) => {
                const done = completedLessonIds.has(lesson.id);
                return `
                <li class="lesson-item">
                  <span class="lesson-check ${done ? "done" : ""}"></span>
                  <a href="/app/lesson.html?lesson=${lesson.id}">${lesson.title}</a>
                </li>`;
              })
              .join("")}
          </ul>
        </div>`
        )
        .join("");

      let quizRowHtml = "";
      if (quizId) {
        let statusLabel = "Verrouillé — terminez les leçons du cours";
        let action = "";
        if (allLessonsDone && !quizPassed) {
          statusLabel = "Prêt à passer";
          action = `<a class="btn btn-sm" href="/app/quiz.html?quiz=${quizId}">Passer le quiz</a>`;
        } else if (quizPassed) {
          statusLabel = "✓ Réussi";
        }
        quizRowHtml = `
          <div class="quiz-row">
            <span>Quiz du cours (20 questions, 75% requis) — ${statusLabel}</span>
            ${action}
          </div>`;
      }

      return `
        <div class="course-block">
          <h2>${course.title}</h2>
          <p class="course-meta">${completedCount} / ${allLessons.length} leçons terminées</p>
          ${modulesHtml}
          ${quizRowHtml}
        </div>`;
    })
    .join("");
}
