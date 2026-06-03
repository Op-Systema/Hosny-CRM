let detailsProfile;
let investor;
let detailsFollowups = [];
let detailsMeetings = [];

bootPage(async (profile) => {
  detailsProfile = profile;
  await loadInvestorDetails();
  bindDetailsEvents();
});

async function loadInvestorDetails() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    q("#investorName").textContent = "لم يتم تحديد مستثمر";
    return;
  }
  const [investorRes, followupsRes, meetingsRes] = await Promise.all([
    db.from("investors").select("*, assigned:profiles!investors_assigned_to_fkey(full_name,email)").eq("id", id).single(),
    db.from("follow_ups").select("*").eq("investor_id", id).order("due_date", { ascending: false }),
    db.from("meetings").select("*").eq("investor_id", id).order("meeting_date", { ascending: false })
  ]);
  if (investorRes.error) throw investorRes.error;
  investor = investorRes.data;
  detailsFollowups = followupsRes.data || [];
  detailsMeetings = meetingsRes.data || [];
  const score = calculateInvestorScore({ ...investor, has_meeting: detailsMeetings.length > 0 }, detailsMeetings);
  if (score !== investor.score) {
    await db.from("investors").update({ score, updated_at: new Date().toISOString() }).eq("id", investor.id);
    investor.score = score;
  }
  renderDetails();
}

function renderDetails() {
  q("#investorName").textContent = investor.full_name;
  q("#profilePanel").innerHTML = `
    <div class="panel-head"><h2>البيانات الأساسية</h2>${renderScoreBadge(investor.score)}</div>
    <div class="stack-list">
      <div class="list-item"><span>الهاتف</span><strong>${escapeHtml(investor.phone || "-")}</strong></div>
      <div class="list-item"><span>البريد</span><strong>${escapeHtml(investor.email || "-")}</strong></div>
      <div class="list-item"><span>المدينة</span><strong>${escapeHtml(investor.city || "-")}</strong></div>
      <div class="list-item"><span>الميزانية</span><strong>${formatCurrency(investor.budget)}</strong></div>
      <div class="list-item"><span>المرحلة</span><strong>${STAGE_LABELS[investor.pipeline_stage] || investor.pipeline_stage}</strong></div>
      <div class="list-item"><span>آخر تواصل</span><strong>${formatDate(investor.last_contacted_at)}</strong></div>
      <div class="list-item"><span>المسؤول</span><strong>${escapeHtml(investor.assigned?.full_name || "غير معين")}</strong></div>
      <div><strong>ملاحظات</strong><p class="muted">${escapeHtml(investor.notes || "لا توجد ملاحظات.")}</p></div>
    </div>
  `;
  q("#followupsList").innerHTML = detailsFollowups.map((item) => `
    <div class="list-item ${new Date(item.due_date) < new Date() && item.status !== "done" ? "overdue" : ""}">
      <span><strong class="row-title">${escapeHtml(item.title)}</strong><span class="row-sub">${formatDate(item.due_date)} · ${item.status}</span></span>
    </div>
  `).join("") || emptyState("لا توجد متابعات.");
  q("#meetingsList").innerHTML = detailsMeetings.map((item) => `
    <div class="list-item">
      <span><strong class="row-title">${formatDate(item.meeting_date)}</strong><span class="row-sub">${escapeHtml(item.next_step || "بدون خطوة قادمة")}</span></span>
      <button class="text-btn" data-summary="${item.id}" type="button">ملخص</button>
    </div>
  `).join("") || emptyState("لا توجد اجتماعات.");
  const timeline = [
    ...detailsFollowups.map((item) => ({ date: item.created_at, title: `متابعة: ${item.title}` })),
    ...detailsMeetings.map((item) => ({ date: item.created_at, title: `اجتماع: ${formatDate(item.meeting_date)}` })),
    { date: investor.created_at, title: "تم إنشاء ملف المستثمر" }
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  q("#timelineList").innerHTML = timeline.map((item) => `<div class="timeline-item"><strong>${escapeHtml(item.title)}</strong><div class="row-sub">${formatDate(item.date)}</div></div>`).join("");
}

function bindDetailsEvents() {
  q("#whatsappBtn").addEventListener("click", () => writeSmart(generateWhatsAppMessage(investor)));
  q("#objectionBtn").addEventListener("click", () => writeSmart(generateObjectionReply(prompt("اكتب الاعتراض") || "", investor)));
  q("#contactNowBtn").addEventListener("click", markContacted);
  q("#addFollowupBtn").addEventListener("click", () => openQuick("followup"));
  q("#addMeetingBtn").addEventListener("click", () => openQuick("meeting"));
  q("#editInvestorBtn").addEventListener("click", () => location.href = `investors.html?edit=${investor.id}`);
  q("#meetingsList").addEventListener("click", (event) => {
    const id = event.target.dataset.summary;
    if (!id) return;
    const meeting = detailsMeetings.find((item) => item.id === id);
    writeSmart(generateMeetingSummary(meeting, investor));
  });
  q("#quickForm").addEventListener("submit", saveQuick);
  qa("[data-close-modal]").forEach((button) => button.addEventListener("click", () => q("#quickModal").classList.add("hidden")));
}

function writeSmart(text) {
  q("#smartOutput").value = text;
  navigator.clipboard?.writeText(text);
}

async function markContacted() {
  const now = new Date().toISOString();
  const { error } = await db.from("investors").update({ last_contacted_at: now, updated_at: now }).eq("id", investor.id);
  if (error) return showToast(error.message, "error");
  showToast("تم تحديث آخر تواصل.");
  await loadInvestorDetails();
}

function openQuick(type) {
  q("#quickTitle").textContent = type === "followup" ? "إضافة متابعة" : "إضافة اجتماع";
  q("#quickForm").dataset.type = type;
  q("#quickForm").innerHTML = type === "followup" ? `
    <label>العنوان<input name="title" required></label>
    <label>تاريخ الاستحقاق<input name="due_date" type="datetime-local" required></label>
    <label class="full">الوصف<textarea name="description"></textarea></label>
    <button class="primary-btn full" type="submit">حفظ المتابعة</button>
  ` : `
    <label>موعد الاجتماع<input name="meeting_date" type="datetime-local" required></label>
    <label class="full">ملاحظات<textarea name="notes"></textarea></label>
    <label class="full">الاعتراضات<textarea name="objections"></textarea></label>
    <label class="full">الخطوة القادمة<textarea name="next_step"></textarea></label>
    <button class="primary-btn full" type="submit">حفظ الاجتماع</button>
  `;
  q("#quickModal").classList.remove("hidden");
}

async function saveQuick(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const type = form.dataset.type;
  const payload = type === "followup"
    ? { investor_id: investor.id, user_id: detailsProfile.id, title: values.title, description: values.description || null, due_date: new Date(values.due_date).toISOString() }
    : { investor_id: investor.id, user_id: detailsProfile.id, meeting_date: new Date(values.meeting_date).toISOString(), notes: values.notes || null, objections: values.objections || null, next_step: values.next_step || null };
  const { error } = await db.from(type === "followup" ? "follow_ups" : "meetings").insert(payload);
  if (error) return showToast(error.message, "error");
  q("#quickModal").classList.add("hidden");
  showToast("تم الحفظ.");
  await loadInvestorDetails();
}
