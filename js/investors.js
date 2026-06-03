let investorsState = [];
let profilesState = [];
let currentProfile;

bootPage(async (profile) => {
  currentProfile = profile;
  renderStageOptions(q('select[name="pipeline_stage"]'));
  renderStageOptions(q("#stageFilter"), "");
  q("#stageFilter").insertAdjacentHTML("afterbegin", '<option value="">كل المراحل</option>');
  await loadData();
  bindInvestorEvents();
  const editId = new URLSearchParams(location.search).get("edit");
  if (editId) {
    const item = investorsState.find((row) => row.id === editId);
    if (item) openInvestorModal(item);
  }
});

async function loadData() {
  [investorsState, profilesState] = await Promise.all([fetchInvestors(), fetchProfiles()]);
  fillFilters();
  renderInvestors();
}

function fillFilters() {
  const cities = [...new Set(investorsState.map((item) => item.city).filter(Boolean))].sort();
  q("#cityFilter").innerHTML = '<option value="">كل المدن</option>' + cities.map((city) => `<option>${escapeHtml(city)}</option>`).join("");
  const salesOptions = profilesState.filter((p) => p.role === "sales").map((p) => `<option value="${p.id}">${escapeHtml(p.full_name || p.email)}</option>`).join("");
  q("#salesFilter").innerHTML = '<option value="">كل مسؤولي المبيعات</option>' + salesOptions;
  q('select[name="assigned_to"]').innerHTML = '<option value="">بدون تعيين</option>' + salesOptions;
}

function filteredInvestors() {
  const search = q("#searchInput").value.trim().toLowerCase();
  const city = q("#cityFilter").value;
  const stage = q("#stageFilter").value;
  const assigned = q("#salesFilter").value;
  return investorsState.filter((item) => {
    const haystack = [item.full_name, item.phone, item.city].join(" ").toLowerCase();
    return (!search || haystack.includes(search)) &&
      (!city || item.city === city) &&
      (!stage || item.pipeline_stage === stage) &&
      (!assigned || item.assigned_to === assigned);
  });
}

function renderInvestors() {
  const rows = filteredInvestors();
  q("#emptyState").classList.toggle("hidden", rows.length > 0);
  q("#investorsTable").innerHTML = rows.map((item) => investorRow(item)).join("");
  q("#investorsCards").innerHTML = rows.map((item) => investorCard(item)).join("");
}

function investorRow(item) {
  return `
    <tr>
      <td><a href="investor-details.html?id=${item.id}"><strong class="row-title">${escapeHtml(item.full_name)}</strong><span class="row-sub">${escapeHtml(item.phone || item.email || "بدون تواصل")}</span></a></td>
      <td>${escapeHtml(item.city || "-")}</td>
      <td>${formatCurrency(item.budget)}</td>
      <td>${STAGE_LABELS[item.pipeline_stage] || item.pipeline_stage}</td>
      <td>${renderScoreBadge(item.score)}</td>
      <td>${escapeHtml(item.assigned?.full_name || "غير معين")}</td>
      <td>
        <button class="text-btn" data-edit="${item.id}" type="button">تعديل</button>
        <button class="text-btn" data-whatsapp="${item.id}" type="button">واتساب</button>
        <button class="text-btn" data-delete="${item.id}" type="button">حذف</button>
      </td>
    </tr>
  `;
}

function investorCard(item) {
  return `
    <article class="mobile-card">
      <a href="investor-details.html?id=${item.id}"><strong class="row-title">${escapeHtml(item.full_name)}</strong></a>
      <span class="row-sub">${escapeHtml(item.city || "-")} · ${formatCurrency(item.budget)}</span>
      <div>${STAGE_LABELS[item.pipeline_stage] || item.pipeline_stage} ${renderScoreBadge(item.score)}</div>
      <div class="actions-row">
        <button class="secondary-btn" data-edit="${item.id}" type="button">تعديل</button>
        <button class="secondary-btn" data-whatsapp="${item.id}" type="button">واتساب</button>
        <button class="danger-btn" data-delete="${item.id}" type="button">حذف</button>
      </div>
    </article>
  `;
}

function bindInvestorEvents() {
  q("#addInvestorBtn").addEventListener("click", () => openInvestorModal());
  qa("#searchInput, #cityFilter, #stageFilter, #salesFilter").forEach((el) => el.addEventListener("input", renderInvestors));
  q("#investorForm").addEventListener("submit", saveInvestor);
  q("#investorsTable").addEventListener("click", tableAction);
  q("#investorsCards").addEventListener("click", tableAction);
  qa("[data-close-modal]").forEach((button) => button.addEventListener("click", closeInvestorModal));
}

function openInvestorModal(item = null) {
  q("#modalTitle").textContent = item ? "تعديل مستثمر" : "إضافة مستثمر";
  const form = q("#investorForm");
  form.reset();
  renderStageOptions(form.pipeline_stage, item?.pipeline_stage || "new_lead");
  if (item) {
    Object.entries(item).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value ?? "";
    });
  } else {
    form.assigned_to.value = currentProfile.role === "sales" ? currentProfile.id : "";
  }
  q("#investorModal").classList.remove("hidden");
}

function closeInvestorModal() {
  q("#investorModal").classList.add("hidden");
}

async function saveInvestor(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  if (!values.full_name.trim()) return showToast("اسم المستثمر مطلوب.", "error");
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return showToast("البريد الإلكتروني غير صحيح.", "error");
  const payload = {
    full_name: values.full_name.trim(),
    phone: values.phone || null,
    email: values.email || null,
    city: values.city || null,
    budget: Number(values.budget || 0),
    business_background: values.business_background || null,
    interested_city: values.interested_city || null,
    lead_source: values.lead_source || null,
    pipeline_stage: values.pipeline_stage || "new_lead",
    assigned_to: currentProfile.role === "admin" ? values.assigned_to || null : currentProfile.id,
    notes: values.notes || null
  };
  payload.score = calculateInvestorScore(payload);
  showLoading("جاري الحفظ...");
  const result = values.id
    ? await db.from("investors").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", values.id)
    : await db.from("investors").insert({ ...payload, created_by: currentProfile.id });
  hideLoading();
  if (result.error) return showToast(result.error.message, "error");
  showToast("تم حفظ بيانات المستثمر.");
  closeInvestorModal();
  await loadData();
}

async function tableAction(event) {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  const whatsappId = event.target.dataset.whatsapp;
  if (editId) return openInvestorModal(investorsState.find((item) => item.id === editId));
  if (whatsappId) {
    const item = investorsState.find((row) => row.id === whatsappId);
    await navigator.clipboard?.writeText(generateWhatsAppMessage(item));
    return showToast("تم نسخ رسالة واتساب.");
  }
  if (deleteId && confirmAction("هل تريد حذف هذا المستثمر؟")) {
    const { error } = await db.from("investors").delete().eq("id", deleteId);
    if (error) return showToast(error.message, "error");
    showToast("تم حذف المستثمر.");
    await loadData();
  }
}
