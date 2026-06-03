let followupsProfile;
let followups = [];
let followupInvestors = [];
let activeTab = "today";

const FOLLOWUP_TABS = [
  ["today", "اليوم"],
  ["overdue", "متأخرة"],
  ["upcoming", "قادمة"],
  ["done", "مكتملة"]
];

bootPage(async (profile) => {
  followupsProfile = profile;
  renderTabs();
  await loadFollowups();
  bindFollowupEvents();
});

async function loadFollowups() {
  const [followupsRes, investors] = await Promise.all([
    db.from("follow_ups").select("*, investor:investors(full_name,city)").order("due_date", { ascending: true }),
    fetchInvestors()
  ]);
  if (followupsRes.error) throw followupsRes.error;
  followups = followupsRes.data || [];
  followupInvestors = investors;
  q('select[name="investor_id"]').innerHTML = investors.map((item) => `<option value="${item.id}">${escapeHtml(item.full_name)}</option>`).join("");
  renderFollowups();
}

function renderTabs() {
  q("#followupTabs").innerHTML = FOLLOWUP_TABS.map(([key, label]) => `<button class="tab-btn ${key === activeTab ? "active" : ""}" data-tab="${key}" type="button">${label}</button>`).join("");
}

function filteredFollowups() {
  const now = new Date();
  const { start, end } = todayRange();
  return followups.filter((item) => {
    const due = new Date(item.due_date);
    if (activeTab === "today") return item.status !== "done" && due >= new Date(start) && due < new Date(end);
    if (activeTab === "overdue") return item.status !== "done" && due < now;
    if (activeTab === "upcoming") return item.status !== "done" && due >= new Date(end);
    return item.status === "done";
  });
}

function renderFollowups() {
  const rows = filteredFollowups();
  q("#followupsList").innerHTML = rows.map((item) => `
    <div class="list-item ${new Date(item.due_date) < new Date() && item.status !== "done" ? "overdue" : ""}">
      <span>
        <strong class="row-title">${escapeHtml(item.title)}</strong>
        <span class="row-sub">${escapeHtml(item.investor?.full_name || "مستثمر")} · ${formatDate(item.due_date)}</span>
        <span class="row-sub">${escapeHtml(item.description || "")}</span>
      </span>
      <div class="actions-row">
        ${item.status !== "done" ? `<button class="secondary-btn" data-done="${item.id}" type="button">تم</button>` : ""}
        <button class="danger-btn" data-delete="${item.id}" type="button">حذف</button>
      </div>
    </div>
  `).join("") || emptyState("لا توجد متابعات في هذا التبويب.");
}

function bindFollowupEvents() {
  q("#followupTabs").addEventListener("click", (event) => {
    if (!event.target.dataset.tab) return;
    activeTab = event.target.dataset.tab;
    renderTabs();
    renderFollowups();
  });
  q("#addFollowupBtn").addEventListener("click", () => q("#followupModal").classList.remove("hidden"));
  qa("[data-close-modal]").forEach((button) => button.addEventListener("click", () => q("#followupModal").classList.add("hidden")));
  q("#followupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const { error } = await db.from("follow_ups").insert({
      investor_id: values.investor_id,
      user_id: followupsProfile.id,
      title: values.title,
      description: values.description || null,
      due_date: new Date(values.due_date).toISOString()
    });
    if (error) return showToast(error.message, "error");
    event.currentTarget.reset();
    q("#followupModal").classList.add("hidden");
    showToast("تمت إضافة المتابعة.");
    await loadFollowups();
  });
  q("#followupsList").addEventListener("click", async (event) => {
    const done = event.target.dataset.done;
    const del = event.target.dataset.delete;
    if (done) {
      const { error } = await db.from("follow_ups").update({ status: "done" }).eq("id", done);
      if (error) return showToast(error.message, "error");
      showToast("تم إكمال المتابعة.");
      await loadFollowups();
    }
    if (del && confirmAction("هل تريد حذف المتابعة؟")) {
      const { error } = await db.from("follow_ups").delete().eq("id", del);
      if (error) return showToast(error.message, "error");
      showToast("تم حذف المتابعة.");
      await loadFollowups();
    }
  });
}
