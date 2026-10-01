// assets/js/layout.js
// Génère la sidebar commune à toutes les pages /app/*.
// Usage : <div id="sidebar"></div> puis renderSidebar('dashboard', profile)

const APP_NAV_ITEMS = [
  { key: "dashboard", label: "Tableau de bord", href: "dashboard.html" },
  { key: "academy", label: "Académie", href: "academy.html" },
  { key: "simulator", label: "Simulateur", href: "simulator.html" },
  { key: "atlas", label: "Coach Atlas", href: "atlas.html" },
  { key: "journal", label: "Journal de trading", href: "journal.html" },
  { key: "community", label: "Communauté", href: "community.html" },
  { key: "certificates", label: "Certificats", href: "certificates.html" },
  { key: "billing", label: "Facturation", href: "billing.html" },
];

function renderSidebar(activeKey, profile) {
  const el = document.getElementById("sidebar");
  if (!el) return;

  const navHtml = APP_NAV_ITEMS.map(
    (item) =>
      `<a href="${item.href}" class="${item.key === activeKey ? "active" : ""}">${item.label}</a>`
  ).join("");

  const adminLink =
    profile && profile.role === "admin"
      ? `<div style="margin-top:16px;border-top:1px solid var(--color-border);padding-top:16px;">
           <a href="/admin/users.html">Espace admin</a>
         </div>`
      : "";

  el.innerHTML = `
    <div class="logo">📈 Académie de Trading</div>
    <nav>${navHtml}${adminLink}</nav>
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
