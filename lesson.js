// assets/js/pages/lesson.js

(async function init() {
  const profile = await requireAuth();
  if (!profile) return;
  renderSidebar("academy", profile);

  const params = new URLSearchParams(window.location.search);
  const lessonId = params.get("lesson");

  if (!lessonId) {
    document.getElementById("lessonContent").innerHTML =
      '<p class="loading-text">Aucune leçon sélectionnée.</p>';
    return;
  }

  try {
    const ctx = await loadLessonContext(profile.id, lessonId);
    if (!ctx.accessAllowed) {
      document.getElementById("lessonMessage").className = "form-message error";
      document.getElementById("lessonMessage").textContent =
        "Vous n'avez pas accès à ce niveau. Débloquez-le pour continuer.";
      document.getElementById("lessonContent").innerHTML = "";
      return;
    }
    renderLesson(ctx);
  } catch (err) {
    console.error("Erreur chargement leçon:", err);
    document.getElementById("lessonContent").innerHTML =
      '<p class="loading-text">Une erreur est survenue lors du chargement de la leçon.</p>';
  }
})();

async function loadLessonContext(userId, lessonId) {
  const { data: lesson, error: lessonError } = await supabaseClient
    .from("lessons")
    .select(
      `id, title, content, video_url, order_index,
       modules ( id, course_id, order_index,
         courses ( id, title, level_id,
           levels ( id, name, price_usd )
         )
       )`
    )
    .eq("id", lessonId)
    .single();
  if (lessonError) throw lessonError;

  const module = lesson.modules;
  const course = module.courses;
  const level = course.levels;

  let accessAllowed = level.price_usd == 0;
  if (!accessAllowed) {
    const { data: payment } = await supabaseClient
      .from("payments")
      .select("id")
      .eq("user_id", userId)
      .eq("level_id", level.id)
      .eq("status", "succeeded")
      .maybeSingle();
    accessAllowed = !!payment;
  }
  if (!accessAllowed) return { accessAllowed: false };

  // Toutes les leçons du cours, ordonnées, pour déterminer "suivante" et "cours terminé"
  const { data: courseLessons, error: courseLessonsError } = await supabaseClient
    .from("lessons")
    .select("id, order_index, module_id, modules!inner(course_id, order_index)")
    .eq("modules.course_id", course.id);
  if (courseLessonsError) throw courseLessonsError;

  const orderedLessons = courseLessons
    .slice()
    .sort((a, b) => a.modules.order_index - b.modules.order_index || a.order_index - b.order_index);

  const { data: progress, error: progressError } = await supabaseClient
    .from("user_lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in(
      "lesson_id",
      orderedLessons.map((l) => l.id)
    );
  if (progressError) throw progressError;
  const completedLessonIds = new Set(progress.map((p) => p.lesson_id));

  const { data: existing } = await supabaseClient
    .from("user_lesson_progress")
    .select("status")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const currentIndex = orderedLessons.findIndex((l) => l.id === lessonId);
  const nextLesson = orderedLessons[currentIndex + 1] || null;

  const { data: quiz } = await supabaseClient
    .from("quizzes")
    .select("id")
    .eq("course_id", course.id)
    .maybeSingle();

  return {
    accessAllowed: true,
    lesson,
    course,
    level,
    nextLesson,
    quiz,
    isCompleted: existing && existing.status === "completed",
    courseAllDoneAfterThis:
      completedLessonIds.size + (completedLessonIds.has(lessonId) ? 0 : 1) === orderedLessons.length,
  };
}

function renderLesson(ctx) {
  document.getElementById("lessonTitle").textContent = ctx.lesson.title;
  document.getElementById("backLink").href = `/app/academy.html?level=${ctx.level.id}`;

  const contentHtml = ctx.lesson.video_url
    ? `<p><a href="${ctx.lesson.video_url}" target="_blank" rel="noopener">▶ Voir la vidéo de la leçon</a></p>${ctx.lesson.content || ""}`
    : ctx.lesson.content || "<p>Contenu à venir.</p>";
  document.getElementById("lessonContent").innerHTML = contentHtml;

  const completeBtn = document.getElementById("completeBtn");
  const completedLabel = document.getElementById("completedLabel");
  const nextLessonLink = document.getElementById("nextLessonLink");

  if (ctx.isCompleted) {
    completedLabel.style.display = "inline";
  } else {
    completeBtn.style.display = "inline-block";
    completeBtn.addEventListener("click", () => markLessonComplete(ctx));
  }

  if (ctx.nextLesson) {
    nextLessonLink.style.display = "inline-block";
    nextLessonLink.href = `/app/lesson.html?lesson=${ctx.nextLesson.id}`;
  }

  if (ctx.courseAllDoneAfterThis && ctx.quiz) {
    document.getElementById("courseCompleteNotice").style.display = "block";
    document.getElementById("quizLink").href = `/app/quiz.html?quiz=${ctx.quiz.id}`;
  }
}

async function markLessonComplete(ctx) {
  const session = await getCurrentSession();
  const { error } = await supabaseClient.from("user_lesson_progress").upsert(
    {
      user_id: session.user.id,
      lesson_id: ctx.lesson.id,
      status: "completed",
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );

  if (error) {
    console.error("Erreur marquage leçon terminée:", error.message);
    document.getElementById("lessonMessage").className = "form-message error";
    document.getElementById("lessonMessage").textContent =
      "Impossible de marquer la leçon comme terminée. Réessayez.";
    return;
  }

  document.getElementById("completeBtn").style.display = "none";
  document.getElementById("completedLabel").style.display = "inline";

  if (ctx.courseAllDoneAfterThis && ctx.quiz) {
    document.getElementById("courseCompleteNotice").style.display = "block";
    document.getElementById("quizLink").href = `/app/quiz.html?quiz=${ctx.quiz.id}`;
  }
}
