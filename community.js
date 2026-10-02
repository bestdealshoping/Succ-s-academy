// assets/js/pages/community.js

let categories = [];
let activeCategoryId = null;
let currentUserId = null;
let currentPostId = null;

(async function init() {
  const profile = await requireAuth();
  if (!profile) return;
  renderSidebar("community", profile);

  const session = await getCurrentSession();
  currentUserId = session.user.id;

  document.getElementById("newPostBtn").addEventListener("click", togglePostForm);
  document.getElementById("cancelPostBtn").addEventListener("click", togglePostForm);
  document.getElementById("postForm").addEventListener("submit", handleCreatePost);
  document.getElementById("backToList").addEventListener("click", (e) => {
    e.preventDefault();
    showList();
  });
  document.getElementById("commentForm").addEventListener("submit", handleCreateComment);

  await loadCategories();
})();

function showMessage(type, text) {
  const el = document.getElementById("communityMessage");
  el.className = `form-message ${type}`;
  el.textContent = text;
}

function togglePostForm() {
  const form = document.getElementById("postForm");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

async function loadCategories() {
  const { data, error } = await supabaseClient.from("community_categories").select("*").order("name");
  if (error) {
    console.error("Erreur chargement catégories:", error.message);
    return;
  }
  categories = data;
  activeCategoryId = categories[0]?.id || null;

  document.getElementById("categoryTabs").innerHTML = categories
    .map(
      (c) =>
        `<button class="category-tab ${c.id === activeCategoryId ? "active" : ""}" data-cat-id="${c.id}">${c.name}</button>`
    )
    .join("");

  document.querySelectorAll("[data-cat-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategoryId = btn.dataset.catId;
      document.querySelectorAll(".category-tab").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      loadPosts();
    });
  });

  await loadPosts();
}

async function loadPosts() {
  const container = document.getElementById("postsContainer");
  container.innerHTML = '<p class="loading-text">Chargement...</p>';

  const { data: posts, error } = await supabaseClient
    .from("community_posts")
    .select("id, title, content, created_at, user_id, is_hidden, profiles(full_name)")
    .eq("category_id", activeCategoryId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur chargement posts:", error.message);
    container.innerHTML = '<p class="loading-text">Erreur de chargement.</p>';
    return;
  }

  // RLS masque déjà les posts cachés des autres, mais on affiche quand même
  // à l'auteur les siens avec une mention, si jamais ils lui reviennent.
  if (posts.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucun post dans cette catégorie pour le moment.</p>';
    return;
  }

  container.innerHTML = posts
    .map(
      (p) => `
      <div class="post-row" data-post-id="${p.id}">
        <h3>${p.title} ${p.is_hidden ? '<span style="font-size:11px;color:var(--color-danger);">(masqué par la modération)</span>' : ""}</h3>
        <p>${p.content}</p>
        <div class="post-meta">${p.profiles?.full_name || "Utilisateur"} · ${new Date(p.created_at).toLocaleDateString("fr-FR")}</div>
      </div>`
    )
    .join("");

  container.querySelectorAll("[data-post-id]").forEach((row) => {
    row.addEventListener("click", () => openPost(row.dataset.postId));
  });
}

async function handleCreatePost(e) {
  e.preventDefault();
  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();

  const submitBtn = document.getElementById("submitPostBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Publication...";

  try {
    const result = await callEdgeFunction("create-post", {
      category_id: activeCategoryId,
      title,
      content,
    });

    document.getElementById("postForm").reset();
    togglePostForm();

    if (result.auto_hidden) {
      showMessage(
        "error",
        "Votre post a été masqué automatiquement par la modération (contenu non autorisé détecté)."
      );
    } else {
      showMessage("success", "Post publié.");
    }
    await loadPosts();
  } catch (err) {
    console.error("Erreur création post:", err);
    showMessage("error", err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Publier";
  }
}

async function openPost(postId) {
  currentPostId = postId;

  const { data: post, error } = await supabaseClient
    .from("community_posts")
    .select("*, profiles(full_name)")
    .eq("id", postId)
    .single();
  if (error) {
    console.error("Erreur chargement post:", error.message);
    return;
  }

  document.getElementById("postsContainer").style.display = "none";
  document.getElementById("categoryTabs").style.display = "none";
  document.getElementById("newPostBtn").style.display = "none";
  document.getElementById("postDetail").style.display = "block";

  document.getElementById("postDetailTitle").textContent = post.title;
  document.getElementById("postDetailMeta").textContent = `${post.profiles?.full_name || "Utilisateur"} · ${new Date(post.created_at).toLocaleString("fr-FR")}`;
  document.getElementById("postDetailContent").textContent = post.content;

  await loadComments(postId);
}

function showList() {
  document.getElementById("postsContainer").style.display = "block";
  document.getElementById("categoryTabs").style.display = "flex";
  document.getElementById("newPostBtn").style.display = "inline-block";
  document.getElementById("postDetail").style.display = "none";
  currentPostId = null;
}

async function loadComments(postId) {
  const container = document.getElementById("commentsContainer");
  container.innerHTML = '<p class="loading-text">Chargement...</p>';

  const { data: comments, error } = await supabaseClient
    .from("community_comments")
    .select("*, profiles(full_name)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erreur chargement commentaires:", error.message);
    container.innerHTML = '<p class="loading-text">Erreur de chargement.</p>';
    return;
  }

  if (comments.length === 0) {
    container.innerHTML = '<p class="loading-text">Aucun commentaire pour le moment.</p>';
    return;
  }

  container.innerHTML = comments
    .map(
      (c) => `
      <div class="comment-row">
        <div class="comment-meta">${c.profiles?.full_name || "Utilisateur"} · ${new Date(c.created_at).toLocaleDateString("fr-FR")}</div>
        ${c.content}
      </div>`
    )
    .join("");
}

async function handleCreateComment(e) {
  e.preventDefault();
  const input = document.getElementById("commentInput");
  const content = input.value.trim();
  if (!content || !currentPostId) return;

  try {
    const result = await callEdgeFunction("create-comment", { post_id: currentPostId, content });
    input.value = "";
    if (result.auto_hidden) {
      showMessage("error", "Votre commentaire a été masqué automatiquement par la modération.");
    }
    await loadComments(currentPostId);
  } catch (err) {
    console.error("Erreur ajout commentaire:", err);
    showMessage("error", err.message);
  }
}
