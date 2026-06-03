let branchesProfile;
let branches = [];

bootPage(async (profile) => {
  branchesProfile = profile;
  await loadBranches();
  bindBranchEvents();
});

async function loadBranches() {
  const { data, error } = await db.from("branches").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  branches = data || [];
  renderBranches();
}

function renderBranches() {
  q("#branchesGrid").innerHTML = branches.map((item) => `
    <article class="branch-card">
      <div class="panel-head"><h2>${escapeHtml(item.branch_name)}</h2><span class="status-badge status-green">${escapeHtml(item.status || "open")}</span></div>
      <span class="row-sub">${escapeHtml(item.city || "-")} · ${escapeHtml(item.area || "-")}</span>
      <span>المالك: <strong>${escapeHtml(item.owner_name || "-")}</strong></span>
      <span>الافتتاح: <strong>${formatDateOnly(item.opening_date)}</strong></span>
      ${branchesProfile.role === "admin" ? `<div class="actions-row"><button class="secondary-btn" data-edit="${item.id}" type="button">تعديل</button><button class="danger-btn" data-delete="${item.id}" type="button">حذف</button></div>` : ""}
    </article>
  `).join("") || emptyState("لا توجد فروع مسجلة.");
}

function bindBranchEvents() {
  q("#addBranchBtn")?.addEventListener("click", () => openBranchModal());
  qa("[data-close-modal]").forEach((button) => button.addEventListener("click", () => q("#branchModal").classList.add("hidden")));
  q("#branchForm").addEventListener("submit", saveBranch);
  q("#branchesGrid").addEventListener("click", async (event) => {
    const edit = event.target.dataset.edit;
    const del = event.target.dataset.delete;
    if (edit) return openBranchModal(branches.find((item) => item.id === edit));
    if (del && confirmAction("هل تريد حذف الفرع؟")) {
      const { error } = await db.from("branches").delete().eq("id", del);
      if (error) return showToast(error.message, "error");
      showToast("تم حذف الفرع.");
      await loadBranches();
    }
  });
}

function openBranchModal(item = null) {
  const form = q("#branchForm");
  form.reset();
  q("#branchModalTitle").textContent = item ? "تعديل فرع" : "إضافة فرع";
  if (item) Object.entries(item).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
  q("#branchModal").classList.remove("hidden");
}

async function saveBranch(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const payload = {
    branch_name: values.branch_name,
    city: values.city || null,
    area: values.area || null,
    status: values.status || "open",
    owner_name: values.owner_name || null,
    opening_date: values.opening_date || null,
    latitude: values.latitude ? Number(values.latitude) : null,
    longitude: values.longitude ? Number(values.longitude) : null
  };
  const result = values.id ? await db.from("branches").update(payload).eq("id", values.id) : await db.from("branches").insert(payload);
  if (result.error) return showToast(result.error.message, "error");
  q("#branchModal").classList.add("hidden");
  showToast("تم حفظ الفرع.");
  await loadBranches();
}
