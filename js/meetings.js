let meetingsProfile;
let meetings = [];
let meetingInvestors = [];

bootPage(async (profile) => {
  meetingsProfile = profile;
  await loadMeetings();
  bindMeetingEvents();
});

async function loadMeetings() {
  const [meetingsRes, investors] = await Promise.all([
    db.from("meetings").select("*, investor:investors(full_name,score,interested_city)").order("meeting_date", { ascending: false }),
    fetchInvestors()
  ]);
  if (meetingsRes.error) throw meetingsRes.error;
  meetings = meetingsRes.data || [];
  meetingInvestors = investors;
  q('select[name="investor_id"]').innerHTML = investors.map((item) => `<option value="${item.id}">${escapeHtml(item.full_name)}</option>`).join("");
  renderMeetings();
}

function renderMeetings() {
  q("#meetingsList").innerHTML = meetings.map((item) => `
    <div class="list-item">
      <span>
        <strong class="row-title">${escapeHtml(item.investor?.full_name || "مستثمر")}</strong>
        <span class="row-sub">${formatDate(item.meeting_date)} · ${escapeHtml(item.next_step || "بدون خطوة قادمة")}</span>
        <span class="row-sub">${escapeHtml(item.notes || "")}</span>
      </span>
      <div class="actions-row">
        <a class="secondary-btn" href="investor-details.html?id=${item.investor_id}">الملف</a>
        <button class="secondary-btn" data-summary="${item.id}" type="button">AI ملخص</button>
        <button class="secondary-btn" data-edit="${item.id}" type="button">تعديل</button>
        <button class="danger-btn" data-delete="${item.id}" type="button">حذف</button>
      </div>
    </div>
  `).join("") || emptyState("لا توجد اجتماعات.");
}

function bindMeetingEvents() {
  q("#addMeetingBtn").addEventListener("click", () => openMeetingModal());
  qa("[data-close-modal]").forEach((button) => button.addEventListener("click", () => q("#meetingModal").classList.add("hidden")));
  q("#meetingForm").addEventListener("submit", saveMeeting);
  q("#meetingsList").addEventListener("click", async (event) => {
    const id = event.target.dataset.edit || event.target.dataset.delete || event.target.dataset.summary;
    const item = meetings.find((row) => row.id === id);
    if (event.target.dataset.edit) return openMeetingModal(item);
    if (event.target.dataset.summary) return alert(generateMeetingSummary(item, item.investor || {}));
    if (event.target.dataset.delete && confirmAction("هل تريد حذف الاجتماع؟")) {
      const { error } = await db.from("meetings").delete().eq("id", id);
      if (error) return showToast(error.message, "error");
      showToast("تم حذف الاجتماع.");
      await loadMeetings();
    }
  });
}

function openMeetingModal(item = null) {
  const form = q("#meetingForm");
  form.reset();
  q("#meetingModalTitle").textContent = item ? "تعديل اجتماع" : "إضافة اجتماع";
  if (item) {
    form.id.value = item.id;
    form.investor_id.value = item.investor_id;
    form.meeting_date.value = toLocalInputValue(item.meeting_date);
    form.notes.value = item.notes || "";
    form.objections.value = item.objections || "";
    form.next_step.value = item.next_step || "";
  }
  q("#meetingModal").classList.remove("hidden");
}

async function saveMeeting(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const payload = {
    investor_id: values.investor_id,
    user_id: meetingsProfile.id,
    meeting_date: new Date(values.meeting_date).toISOString(),
    notes: values.notes || null,
    objections: values.objections || null,
    next_step: values.next_step || null
  };
  const result = values.id
    ? await db.from("meetings").update(payload).eq("id", values.id)
    : await db.from("meetings").insert(payload);
  if (result.error) return showToast(result.error.message, "error");
  q("#meetingModal").classList.add("hidden");
  showToast("تم حفظ الاجتماع.");
  await loadMeetings();
}
