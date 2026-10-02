// assets/js/pages/atlas.js

let currentConversationId = null;
let pendingImage = null; // { base64, mediaType, previewUrl }

(async function init() {
  const profile = await requireAuth();
  if (!profile) return;
  renderSidebar("atlas", profile);

  document.getElementById("newConvBtn").addEventListener("click", startNewConversation);
  document.getElementById("atlasForm").addEventListener("submit", handleSend);
  document.getElementById("imageInput").addEventListener("change", handleImageSelect);
  document.getElementById("removeImageBtn").addEventListener("click", clearImage);

  const messageInput = document.getElementById("messageInput");
  messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
  });
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.getElementById("atlasForm").requestSubmit();
    }
  });

  await loadConversations();
})();

async function loadConversations() {
  const session = await getCurrentSession();
  const { data: conversations, error } = await supabaseClient
    .from("atlas_conversations")
    .select("id, title, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur chargement conversations:", error.message);
    return;
  }

  renderConversationList(conversations);

  if (conversations.length > 0 && !currentConversationId) {
    await openConversation(conversations[0].id);
  } else if (conversations.length === 0) {
    document.getElementById("chatMessages").innerHTML =
      '<p class="loading-text">Posez votre première question à Atlas ci-dessous.</p>';
  }
}

function renderConversationList(conversations) {
  const container = document.getElementById("convList");
  if (conversations.length === 0) {
    container.innerHTML = '<p class="loading-text" style="padding:10px;">Aucune conversation.</p>';
    return;
  }
  container.innerHTML = conversations
    .map(
      (c) => `
      <button class="conv-item ${c.id === currentConversationId ? "active" : ""}" data-conv-id="${c.id}">
        ${c.title || "Conversation"}
      </button>`
    )
    .join("");

  container.querySelectorAll("[data-conv-id]").forEach((btn) => {
    btn.addEventListener("click", () => openConversation(btn.dataset.convId));
  });
}

function startNewConversation() {
  currentConversationId = null;
  document.getElementById("chatMessages").innerHTML =
    '<p class="loading-text">Nouvelle conversation — posez votre question à Atlas.</p>';
  document.querySelectorAll(".conv-item").forEach((el) => el.classList.remove("active"));
}

async function openConversation(conversationId) {
  currentConversationId = conversationId;
  document.querySelectorAll(".conv-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.convId === conversationId);
  });

  const { data: messages, error } = await supabaseClient
    .from("atlas_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erreur chargement messages:", error.message);
    return;
  }

  const container = document.getElementById("chatMessages");
  container.innerHTML = "";
  for (const msg of messages) {
    await appendBubble(msg.role, msg.content, msg.chart_image_path);
  }
  container.scrollTop = container.scrollHeight;
}

async function appendBubble(role, text, chartImagePath) {
  const container = document.getElementById("chatMessages");
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;

  if (chartImagePath) {
    const { data, error } = await supabaseClient.storage
      .from("atlas-charts")
      .createSignedUrl(chartImagePath, 3600);
    if (!error && data) {
      const img = document.createElement("img");
      img.src = data.signedUrl;
      bubble.appendChild(img);
    }
  }

  const textNode = document.createElement("div");
  textNode.textContent = text;
  bubble.appendChild(textNode);

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result.split(",")[1];
    pendingImage = { base64, mediaType: file.type, previewUrl: reader.result };
    document.getElementById("imagePreview").src = reader.result;
    document.getElementById("imagePreviewRow").style.display = "flex";
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  pendingImage = null;
  document.getElementById("imageInput").value = "";
  document.getElementById("imagePreviewRow").style.display = "none";
}

async function handleSend(e) {
  e.preventDefault();
  const input = document.getElementById("messageInput");
  const message = input.value.trim();

  if (!message && !pendingImage) return;

  const sendBtn = document.getElementById("sendBtn");
  sendBtn.disabled = true;
  sendBtn.textContent = "...";

  // Si c'était l'état "aucune conversation", nettoie le message par défaut
  const container = document.getElementById("chatMessages");
  if (container.querySelector(".loading-text")) container.innerHTML = "";

  await appendBubble("user", message || "[Graphique envoyé]", null);
  if (pendingImage) {
    const lastBubble = container.lastElementChild;
    const img = document.createElement("img");
    img.src = pendingImage.previewUrl;
    lastBubble.prepend(img);
  }

  const pendingBubble = document.createElement("div");
  pendingBubble.className = "chat-bubble assistant pending";
  pendingBubble.textContent = "Atlas réfléchit...";
  container.appendChild(pendingBubble);
  container.scrollTop = container.scrollHeight;

  try {
    const payload = {
      conversation_id: currentConversationId,
      message: message || undefined,
      image_base64: pendingImage ? pendingImage.base64 : undefined,
      image_media_type: pendingImage ? pendingImage.mediaType : undefined,
    };
    const result = await callEdgeFunction("atlas-chat", payload);

    pendingBubble.remove();
    await appendBubble("assistant", result.reply, null);

    const isNewConv = !currentConversationId;
    currentConversationId = result.conversation_id;
    input.value = "";
    input.style.height = "auto";
    clearImage();

    if (isNewConv) await loadConversations();
  } catch (err) {
    console.error("Erreur Atlas:", err);
    pendingBubble.textContent = "Erreur : " + err.message;
    pendingBubble.classList.remove("pending");
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Envoyer";
  }
}
