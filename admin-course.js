// assets/js/pages/admin-courses.js
// Tout passe par des appels directs à Supabase (pas d'Edge Function) :
// les policies RLS "..._admin_write" vérifient déjà public.is_admin() côté
// base de données, donc un non-admin ne peut rien écrire ici de toute façon.

let levels = [];
let activeLevelId = null;
let modalContext = null; // { type: 'course'|'module'|'lesson', mode: 'create'|'edit', ...ids, record }

(async function init() {
  const profile = await requireAdmin();
  if (!profile) return;
  renderAdminSidebar("courses", profile);

  document.getElementById("addCourseBtn").addEventListener("click", () => openCourseModal("create"));
  document.getElementById("modalCancelBtn").addEventListener("click", closeModal);
  document.getElementById("modalSaveBtn").addEventListener("click", handleModalSave);
  document.getElementById("modalDeleteBtn").addEventListener("click", handleModalDelete);

  await loadLevels();
})();

function showMessage(type, text) {
  const el = document.getElementById("adminMessage");
  el.className = `form-message ${type}`;
  el.textContent = text;
}

async function loadLevels() {
  const { data, error } = await supabaseClient.from("levels").select("*").order("order_index");
  if (error) {
    console.error("Erreur chargement niveaux:", error.message);
    return;
  }
  levels = data;
  activeLevelId = levels[0]?.id || null;

  document.getElementById("levelTabs").innerHTML = levels
    .map((l) => `<button class="level-tab ${l.id === activeLevelId ? "active" : ""}" data-level-id="${l.id}">${l.name}</button>`)
    .join("");

  document.querySelectorAll("[data-level-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeLevelId = btn.dataset.levelId;
      document.querySelectorAll(".level-tab").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      loadCourses();
    });
  });

  await loadCourses();
}

async function loadCourses() {
  const container = document.getElementById("coursesContainer");
  container.innerHTML = '<p class="loading-text">Chargement...</p>';

  const { data: courses, error } = await supabaseClient
    .from("courses")
    .select("*, modules(*, lessons(*))")
    .eq("level_id", activeLevelId)
    .order("order_index");

  if (error) {
    console.error("Erreur chargement cours:", error.message);
    container.innerHTML = '<p class="loading-text">Erreur de chargement.</p>';
    return;
  }

  courses.forEach((c) => (c.modules = (c.modules || []).sort((a, b) => a.order_index - b.order_index)));
  courses.forEach((c) => c.modules.forEach((m) => (m.lessons = (m.lessons || []).sort((a, b) => a.order_index - b.order_index))));

  if (courses.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucun cours dans ce niveau. Ajoutez-en un ci-dessous.</p>';
    return;
  }

  container.innerHTML = courses
    .map(
      (course) => `
      <div class="admin-course-block">
        <div class="admin-course-head">
          <h3>${course.order_index}. ${course.title}</h3>
          <div class="admin-row-actions">
            <button class="icon-btn" data-edit-course="${course.id}">Modifier</button>
            <button class="icon-btn" data-add-module="${course.id}">+ Module</button>
          </div>
        </div>
        <p style="font-size:13px;color:var(--color-text-muted);margin:4px 0 0;">${course.description || ""}</p>

        ${course.modules
          .map(
            (module) => `
          <div class="admin-module-block">
            <div class="admin-module-head">
              <span>${module.order_index}. ${module.title}</span>
              <div class="admin-row-actions">
                <button class="icon-btn" data-edit-module="${module.id}" data-course-id="${course.id}">Modifier</button>
                <button class="icon-btn" data-add-lesson="${module.id}">+ Leçon</button>
              </div>
            </div>
            ${module.lessons
              .map(
                (lesson) => `
              <div class="admin-lesson-row">
                <span>${lesson.order_index}. ${lesson.title}</span>
                <button class="icon-btn" data-edit-lesson="${lesson.id}" data-module-id="${module.id}">Modifier</button>
              </div>`
              )
              .join("")}
            ${module.lessons.length === 0 ? '<p style="font-size:12px;color:var(--color-text-muted);margin:6px 0 0;">Aucune leçon.</p>' : ""}
          </div>`
          )
          .join("")}
      </div>`
    )
    .join("");

  // Listeners
  container.querySelectorAll("[data-edit-course]").forEach((btn) => {
    const course = courses.find((c) => c.id === btn.dataset.editCourse);
    btn.addEventListener("click", () => openCourseModal("edit", course));
  });
  container.querySelectorAll("[data-add-module]").forEach((btn) => {
    btn.addEventListener("click", () => openModuleModal("create", { courseId: btn.dataset.addModule }));
  });
  container.querySelectorAll("[data-edit-module]").forEach((btn) => {
    const course = courses.find((c) => c.id === btn.dataset.courseId);
    const module = course.modules.find((m) => m.id === btn.dataset.editModule);
    btn.addEventListener("click", () => openModuleModal("edit", { courseId: course.id, record: module }));
  });
  container.querySelectorAll("[data-add-lesson]").forEach((btn) => {
    btn.addEventListener("click", () => openLessonModal("create", { moduleId: btn.dataset.addLesson }));
  });
  container.querySelectorAll("[data-edit-lesson]").forEach((btn) => {
    const allModules = courses.flatMap((c) => c.modules);
    const module = allModules.find((m) => m.id === btn.dataset.moduleId);
    const lesson = module.lessons.find((l) => l.id === btn.dataset.editLesson);
    btn.addEventListener("click", () => openLessonModal("edit", { moduleId: module.id, record: lesson }));
  });
}

// ---------- Modale générique ----------

function openModal(title, fieldsHtml, showDelete) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalFields").innerHTML = fieldsHtml;
  document.getElementById("modalDeleteBtn").style.display = showDelete ? "inline-block" : "none";
  document.getElementById("adminModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("adminModal").style.display = "none";
  modalContext = null;
}

function openCourseModal(mode, record) {
  modalContext = { type: "course", mode, record };
  const title = mode === "create" ? "Nouveau cours" : "Modifier le cours";
  openModal(
    title,
    `
    <label>Titre
      <input type="text" id="f_title" value="${record?.title || ""}" />
    </label>
    <label>Description
      <textarea id="f_description" rows="3">${record?.description || ""}</textarea>
    </label>
    <label>Ordre (1 ou 2)
      <input type="number" id="f_order" value="${record?.order_index || 1}" min="1" />
    </label>`,
    mode === "edit"
  );
}

function openModuleModal(mode, { courseId, record }) {
  modalContext = { type: "module", mode, courseId, record };
  const title = mode === "create" ? "Nouveau module" : "Modifier le module";
  openModal(
    title,
    `
    <label>Titre
      <input type="text" id="f_title" value="${record?.title || ""}" />
    </label>
    <label>Ordre (1 à 3)
      <input type="number" id="f_order" value="${record?.order_index || 1}" min="1" max="3" />
    </label>`,
    mode === "edit"
  );
}

function openLessonModal(mode, { moduleId, record }) {
  modalContext = { type: "lesson", mode, moduleId, record };
  const title = mode === "create" ? "Nouvelle leçon" : "Modifier la leçon";
  openModal(
    title,
    `
    <label>Titre
      <input type="text" id="f_title" value="${record?.title || ""}" />
    </label>
    <label>Contenu (HTML ou texte simple)
      <textarea id="f_content" rows="5">${record?.content || ""}</textarea>
    </label>
    <label>URL vidéo (optionnel)
      <input type="text" id="f_video_url" value="${record?.video_url || ""}" />
    </label>
    <label>Ordre (1 à 5)
      <input type="number" id="f_order" value="${record?.order_index || 1}" min="1" max="5" />
    </label>`,
    mode === "edit"
  );
}

async function handleModalSave() {
  const saveBtn = document.getElementById("modalSaveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Enregistrement...";

  try {
    if (modalContext.type === "course") await saveCourse();
    else if (modalContext.type === "module") await saveModule();
    else if (modalContext.type === "lesson") await saveLesson();

    closeModal();
    await loadCourses();
    showMessage("success", "Enregistré.");
  } catch (err) {
    console.error("Erreur enregistrement:", err);
    showMessage("error", err.message || "Erreur lors de l'enregistrement.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Enregistrer";
  }
}

async function saveCourse() {
  const payload = {
    level_id: activeLevelId,
    title: document.getElementById("f_title").value.trim(),
    description: document.getElementById("f_description").value.trim(),
    order_index: parseInt(document.getElementById("f_order").value, 10),
  };
  if (!payload.title) throw new Error("Le titre est requis.");

  if (modalContext.mode === "create") {
    const { error } = await supabaseClient.from("courses").insert(payload);
    if (error) throw error;
  } else {
    const { error } = await supabaseClient.from("courses").update(payload).eq("id", modalContext.record.id);
    if (error) throw error;
  }
}

async function saveModule() {
  const payload = {
    course_id: modalContext.courseId,
    title: document.getElementById("f_title").value.trim(),
    order_index: parseInt(document.getElementById("f_order").value, 10),
  };
  if (!payload.title) throw new Error("Le titre est requis.");

  if (modalContext.mode === "create") {
    const { error } = await supabaseClient.from("modules").insert(payload);
    if (error) throw error;
  } else {
    const { error } = await supabaseClient.from("modules").update(payload).eq("id", modalContext.record.id);
    if (error) throw error;
  }
}

async function saveLesson() {
  const payload = {
    module_id: modalContext.moduleId,
    title: document.getElementById("f_title").value.trim(),
    content: document.getElementById("f_content").value,
    video_url: document.getElementById("f_video_url").value.trim() || null,
    order_index: parseInt(document.getElementById("f_order").value, 10),
  };
  if (!payload.title) throw new Error("Le titre est requis.");

  if (modalContext.mode === "create") {
    const { error } = await supabaseClient.from("lessons").insert(payload);
    if (error) throw error;
  } else {
    const { error } = await supabaseClient.from("lessons").update(payload).eq("id", modalContext.record.id);
    if (error) throw error;
  }
}

async function handleModalDelete() {
  if (!modalContext || modalContext.mode !== "edit") return;
  if (!confirm("Supprimer définitivement cet élément et tout ce qu'il contient ?")) return;

  const table = { course: "courses", module: "modules", lesson: "lessons" }[modalContext.type];
  const { error } = await supabaseClient.from(table).delete().eq("id", modalContext.record.id);

  if (error) {
    showMessage("error", "Erreur lors de la suppression : " + error.message);
    return;
  }
  closeModal();
  await loadCourses();
  showMessage("success", "Supprimé.");
}
