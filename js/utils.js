const db = window.supabaseClient;

const STAGES = [
  ["new_lead", "عميل جديد"],
  ["contacted", "تم التواصل"],
  ["meeting_scheduled", "اجتماع محدد"],
  ["proposal_sent", "تم إرسال العرض"],
  ["negotiation", "تفاوض"],
  ["approved", "موافقة"],
  ["contract_signed", "توقيع العقد"],
  ["branch_opening", "افتتاح الفرع"],
  ["closed_lost", "مرفوض"]
];

const STAGE_LABELS = Object.fromEntries(STAGES);
const STAGE_POINTS = Object.fromEntries(STAGES.map(([key], index) => [key, index * 8]));

function q(selector, root = document) {
  return root.querySelector(selector);
}

function qa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "غير محدد";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDateOnly(value) {
  if (!value) return "غير محدد";
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(value));
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function toLocalInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function showToast(message, type = "success") {
  let stack = q(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 3400);
}

function showLoading(text = "جاري التحميل...") {
  hideLoading();
  const loader = document.createElement("div");
  loader.className = "loader";
  loader.id = "globalLoader";
  loader.textContent = text;
  document.body.appendChild(loader);
}

function hideLoading() {
  q("#globalLoader")?.remove();
}

async function getCurrentProfile() {
  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  if (sessionError || !sessionData.session) return null;
  const user = sessionData.session.user;
  const { data, error } = await db.from("profiles").select("*").eq("id", user.id).single();
  if (error) {
    console.error(error);
    return {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.email,
      role: "sales",
      is_active: true
    };
  }
  return data;
}

async function requireAuth() {
  const { data } = await db.auth.getSession();
  if (!data.session) {
    window.location.replace(pathToRoot() + "auth/login.html");
    return null;
  }
  const profile = await getCurrentProfile();
  if (!profile?.is_active) {
    await db.auth.signOut();
    window.location.replace(pathToRoot() + "auth/login.html");
    return null;
  }
  return profile;
}

async function requireAdmin() {
  const profile = await requireAuth();
  if (!profile) return null;
  if (profile.role !== "admin") {
    window.location.replace(pathToRoot() + "dashboard.html");
    return null;
  }
  return profile;
}

function pathToRoot() {
  return location.pathname.includes("/auth/") ? "../" : "";
}

function isAdmin(profile) {
  return profile?.role === "admin";
}

function scoreInfo(score) {
  const value = Number(score || 0);
  if (value >= 80) return { label: "Hot", className: "score-hot" };
  if (value >= 50) return { label: "Warm", className: "score-warm" };
  return { label: "Cold", className: "score-cold" };
}

function calculateInvestorScore(investor, meetings = []) {
  let score = 10;
  const budget = Number(investor.budget || 0);
  if (budget >= 1000000) score += 30;
  else if (budget >= 500000) score += 18;
  else if (budget >= 250000) score += 10;
  score += STAGE_POINTS[investor.pipeline_stage] || 0;
  if (investor.business_background) score += 10;
  if (meetings.length > 0 || investor.has_meeting) score += 12;
  if (investor.last_contacted_at) {
    const days = (Date.now() - new Date(investor.last_contacted_at).getTime()) / 86400000;
    if (days <= 7) score += 10;
    else if (days <= 30) score += 4;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateWhatsAppMessage(investor = {}) {
  return `أستاذ/ة ${investor.full_name || "حضرتك"}، سعدنا بالتواصل معكم بخصوص فرصة الفرنشايز. نحب نتابع مع حضرتكم الخطوة القادمة ونرتب موعد مناسب لمناقشة التفاصيل وخطة الاستثمار.`;
}

function generateObjectionReply(objection = "", investor = {}) {
  const text = objection.toLowerCase();
  if (text.includes("سعر") || text.includes("غالي") || text.includes("تكلفة") || text.includes("price")) {
    return "أتفهم تمامًا أن حجم الاستثمار مهم، لكن قيمة الفرنشايز لا تقاس فقط برسوم البداية، بل تشمل قوة العلامة، التشغيل، الدعم، والخبرة المتراكمة لأكثر من 100 فرع.";
  }
  if (text.includes("مخاطرة") || text.includes("risk")) {
    return "طبيعي أي استثمار يحتاج تقييم للمخاطر. ميزتنا أن النموذج قائم بالفعل على فروع كثيرة، ونقدر نعرض لحضرتك بيانات تشغيل تساعدك تقيس القرار بشكل أوضح.";
  }
  return `بالنسبة لاعتراض ${investor.full_name || "المستثمر"}، الأفضل نربط الرد بالأرقام: قوة العلامة، خبرة التشغيل، الدعم المستمر، وخطوات الافتتاح الواضحة.`;
}

function generateMeetingSummary(meeting = {}, investor = {}) {
  const objections = meeting.objections || "لا توجد اعتراضات مسجلة";
  const next = meeting.next_step || "تحديد متابعة قريبة";
  const probability = investor.score >= 80 ? "مرتفع" : investor.score >= 50 ? "متوسط" : "يحتاج تأهيل";
  return [
    "ملخص الاجتماع:",
    meeting.notes || "تمت مناقشة فرصة الفرنشايز واحتياجات المستثمر.",
    "",
    "احتياجات المستثمر:",
    investor.interested_city ? `يركز على مدينة ${investor.interested_city}.` : "يحتاج تحديد المدينة والميزانية بدقة.",
    "",
    "الاعتراضات:",
    objections,
    "",
    "الخطوة القادمة:",
    next,
    "",
    `احتمال الإغلاق: ${probability}.`
  ].join("\n");
}

function renderStageOptions(select, selected = "new_lead") {
  select.innerHTML = STAGES.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
}

function renderScoreBadge(score) {
  const info = scoreInfo(score);
  return `<span class="score-badge ${info.className}">${info.label} ${Number(score || 0)}</span>`;
}

function confirmAction(message) {
  return window.confirm(message);
}

async function fetchProfiles() {
  const { data, error } = await db.from("profiles").select("*").order("full_name");
  if (error) throw error;
  return data || [];
}

async function fetchInvestors() {
  const { data, error } = await db
    .from("investors")
    .select("*, assigned:profiles!investors_assigned_to_fkey(full_name,email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function logActivity(action, entityType, entityId) {
  const profile = await getCurrentProfile();
  if (!profile) return;
  await db.from("activity_logs").insert({
    user_id: profile.id,
    action,
    entity_type: entityType,
    entity_id: entityId || null
  });
}

function emptyState(text = "لا توجد بيانات حتى الآن.") {
  return `<div class="empty-state">${text}</div>`;
}
