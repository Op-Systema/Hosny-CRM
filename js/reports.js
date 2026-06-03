let reportsProfile;

bootPage(async (profile) => {
  reportsProfile = profile;
  q("#printBtn").addEventListener("click", () => window.print());
  const [investors, followupsRes, profilesRes] = await Promise.all([
    fetchInvestors(),
    db.from("follow_ups").select("status,user_id"),
    db.from("profiles").select("*")
  ]);
  if (followupsRes.error) throw followupsRes.error;
  renderReportStats(investors, followupsRes.data || []);
  chart("sourceChart", countByKey(investors, "lead_source"), "bar");
  chart("stageChart", countByKey(investors, "pipeline_stage", STAGE_LABELS), "doughnut");
  chart("closedChart", closedByMonth(investors), "line");
  chart("followupChart", countByKey(followupsRes.data || [], "status", { pending: "معلقة", done: "مكتملة", overdue: "متأخرة" }), "pie");
  if (reportsProfile.role === "admin") renderSalesPerformance(profilesRes.data || [], investors);
});

function renderReportStats(investors, followups) {
  const done = followups.filter((f) => f.status === "done").length;
  const completion = Math.round((done / Math.max(followups.length, 1)) * 100);
  q("#reportStats").innerHTML = [
    ["إجمالي المستثمرين", investors.length],
    ["العقود", investors.filter((i) => ["contract_signed", "branch_opening"].includes(i.pipeline_stage)).length],
    ["متوسط الدرجة", Math.round(investors.reduce((sum, i) => sum + Number(i.score || 0), 0) / Math.max(investors.length, 1))],
    ["إنجاز المتابعات", `${completion}%`]
  ].map(([label, value]) => `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function countByKey(rows, key, labels = {}) {
  return rows.reduce((acc, row) => {
    const label = labels[row[key]] || row[key] || "غير محدد";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function closedByMonth(investors) {
  return investors
    .filter((item) => ["contract_signed", "branch_opening"].includes(item.pipeline_stage))
    .reduce((acc, item) => {
      const month = new Date(item.updated_at || item.created_at).toLocaleDateString("ar-EG", { month: "short", year: "numeric" });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});
}

function chart(id, counts, type) {
  const labels = Object.keys(counts);
  new Chart(q(`#${id}`), {
    type,
    data: {
      labels: labels.length ? labels : ["لا توجد بيانات"],
      datasets: [{ data: labels.length ? Object.values(counts) : [1], backgroundColor: ["#C9A227", "#2563EB", "#16A34A", "#DC2626", "#64748B", "#9333EA"], borderColor: "#C9A227", tension: 0.35 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
  });
}

function renderSalesPerformance(profiles, investors) {
  const sales = profiles.filter((p) => p.role === "sales");
  q("#salesPerformance").innerHTML = sales.map((person) => {
    const assigned = investors.filter((item) => item.assigned_to === person.id);
    const closed = assigned.filter((item) => ["contract_signed", "branch_opening"].includes(item.pipeline_stage));
    return `<div class="list-item"><span><strong class="row-title">${escapeHtml(person.full_name || person.email)}</strong><span class="row-sub">${assigned.length} مستثمر معين</span></span><span class="status-badge status-green">${closed.length} عقد</span></div>`;
  }).join("") || emptyState("لا يوجد مستخدمو مبيعات.");
}
