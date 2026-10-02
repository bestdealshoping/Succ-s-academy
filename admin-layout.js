// assets/js/admin-layout.js
// Sidebar dédiée au back-office, séparée de renderSidebar() (layout.js) qui
// sert l'espace étudiant.

const ADMIN_NAV_ITEMS = [
  { key: "courses", label: "Contenu académique", href: "course.html" },
  { key: "users", label: "Utilisateurs", href: "users.html" },
  { key: "payments", label: "Paiements", href: "payments.html" },
  { key: "community", label: "Communauté", href: "admin-community.html" },
  { key: "stats", label: "Statistiques", href: "stats.html" },
  { key: "audit-logs", label: "Logs & audit", href: "admin-audit-logs.html" },
];

function renderAdminSidebar(activeKey, profile) {
  const el = document.getElementById("sidebar");
  if (!el) return;

  const navHtml = ADMIN_NAV_ITEMS.map(
    (item) =>
      `<a href="${item.href}" class="${item.key === activeKey ? "active" : ""}">${item.label}</a>`
  ).join("");

  el.innerHTML = `
    <div class="logo">🛠 Back-office</div>
    <nav>${navHtml}
      <div style="margin-top:16px;border-top:1px solid var(--color-border);padding-top:16px;">
        <a href="dashboard.html">← Retour à l'académie</a>
      </div>
    </nav>
    <div class="signout">
      <span style="font-size:13px;color:var(--color-text-muted);display:block;margin-bottom:8px;">
        ${profile ? profile.full_name : ""}
      </span>
      <a href="#" id="signOutLink">Se déconnecter</a>
    </div>
  `;

  const signOutLink = document.getElementById("signOutLink");
  if (signOutLink) {
    signOutLink.addEventListener("click", (e) => {
      e.preventDefault();
      signOut();
    });
  }
}
