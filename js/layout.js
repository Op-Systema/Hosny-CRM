const NAV_ITEMS = [
  ["dashboard", "لوحة التحكم", "dashboard.html", "▦"],
  ["investors", "المستثمرون", "investors.html", "◉"],
  ["pipeline", "خط البيع", "pipeline.html", "▥"],
  ["followups", "المتابعات", "followups.html", "✓"],
  ["meetings", "الاجتماعات", "meetings.html", "◷"],
  ["reports", "التقارير", "reports.html", "▤"],
  ["branches", "الفروع", "branches.html", "⌂"],
  ["ai", "المساعد", "ai-assistant.html", "✦"],
  ["users", "المستخدمون", "users.html", "◇", "admin"],
  ["settings", "الإعدادات", "settings.html", "⚙"]
];

async function bootPage(init, options = {}) {
  showLoading();
  const profile = options.adminOnly ? await requireAdmin() : await requireAuth();
  if (!profile) return;
  renderLayout(profile);
  try {
    await init(profile);
  } catch (error) {
    console.error(error);
    showToast(error.message || "حدث خطأ غير متوقع.", "error");
  } finally {
    hideLoading();
  }
}

function renderLayout(profile) {
  const content = q("#pageContent");
  if (!content || q(".app-shell")) return;
  const active = document.body.dataset.page || "dashboard";
  const visibleItems = NAV_ITEMS.filter((item) => !item[4] || profile.role === item[4]);
  const title = NAV_ITEMS.find((item) => item[0] === active)?.[1] || "Hosny CRM";
  document.body.classList.add("app-body");
  const shell = document.createElement("div");
  shell.className = "app-shell";
  shell.innerHTML = `
    <aside class="sidebar">
      <a class="side-brand" href="dashboard.html">
        <img class="brand-logo" src="${pathToRoot()}assets/hosny-logo.png" alt="Hosny CRM">
        <span><strong>Hosny CRM</strong><span>Franchise Sales</span></span>
      </a>
      <nav class="nav-list">
        ${visibleItems.map((item) => navLink(item, active)).join("")}
      </nav>
      <div class="side-footer">
        <strong>${escapeHtml(profile.full_name || profile.email)}</strong>
        <span class="role-badge">${profile.role === "admin" ? "مدير" : "مبيعات"}</span>
      </div>
    </aside>
    <div class="main-area">
      <header class="topbar">
        <div class="topbar-title">${title}</div>
        <div class="topbar-actions">
          <span class="role-badge">${profile.role === "admin" ? "مدير" : "مبيعات"}</span>
          <button id="logoutBtn" class="secondary-btn" type="button">خروج</button>
        </div>
      </header>
    </div>
    <nav class="bottom-nav">
      ${visibleItems.slice(0, 5).map((item) => navLink(item, active, true)).join("")}
    </nav>
  `;
  document.body.appendChild(shell);
  q(".main-area", shell).appendChild(content);
  q("#logoutBtn")?.addEventListener("click", logout);
  qa(".admin-only").forEach((element) => {
    if (profile.role !== "admin") element.classList.add("hidden");
  });
}

function navLink(item, active, compact = false) {
  const [key, label, href, icon] = item;
  const className = compact ? (key === active ? "active" : "") : `nav-item ${key === active ? "active" : ""}`;
  return `<a class="${className}" href="${href}"><span class="nav-icon">${icon}</span>${compact ? `<span>${label}</span>` : escapeHtml(label)}</a>`;
}
