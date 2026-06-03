bootPage(async () => {
  const { start, end } = todayRange();
  const [investors, followupsRes, meetingsRes] = await Promise.all([
    fetchInvestors(),
    db.from("follow_ups").select("*, investor:investors(full_name)").order("due_date"),
    db.from("meetings").select("*, investor:investors(full_name)").gte("meeting_date", start).lt("meeting_date", end)
  ]);
  if (followupsRes.error) throw followupsRes.error;
  if (meetingsRes.error) throw meetingsRes.error;
  const followups = followupsRes.data || [];
  const meetingsToday = meetingsRes.data || [];
  const overdue = followups.filter((item) => item.status !== "done" && new Date(item.due_date) < new Date());
  const hot = investors.filter((item) => Number(item.score || 0) >= 80);
  const contracts = investors.filter((item) => item.pipeline_stage === "contract_signed" || item.pipeline_stage === "branch_opening");
  const targetPercent = Math.min(100, Math.round((contracts.length / Math.max(investors.length, 1)) * 100));

  renderStats([
    ["إجمالي المستثمرين", investors.length],
    ["مستثمرين جدد", investors.filter((item) => item.pipeline_stage === "new_lead").length],
    ["اجتماعات اليوم", meetingsToday.length],
    ["متابعات متأخرة", overdue.length],
    ["فرص ساخنة", hot.length],
    ["عقود مغلقة", contracts.length],
    ["نسبة تحقيق التارجت", `${targetPercent}%`]
  ]);

  q("#aiBriefing").textContent = `لديك ${investors.length} مستثمر نشط، ${hot.length} فرص قوية، و${overdue.length} متابعات متأخرة تحتاج إجراء اليوم. ${meetingsToday.length ? `يوجد ${meetingsToday.length} اجتماع اليوم.` : "لا توجد اجتماعات مسجلة اليوم."}`;
  q("#hotInvestors").innerHTML = hot.slice(0, 5).map((item) => `
    <a class="list-item" href="investor-details.html?id=${item.id}">
      <span><strong class="row-title">${escapeHtml(item.full_name)}</strong><span class="row-sub">${escapeHtml(item.city || "بدون مدينة")} · ${STAGE_LABELS[item.pipeline_stage] || item.pipeline_stage}</span></span>
      ${renderScoreBadge(item.score)}
    </a>
  `).join("") || emptyState("لا توجد فرص ساخنة حتى الآن.");

  makeChart("stageChart", countBy(investors, "pipeline_stage", STAGE_LABELS), "bar");
  makeChart("sourceChart", countBy(investors, "lead_source"), "doughnut");
});

function renderStats(stats) {
  q("#statsGrid").innerHTML = stats.map(([label, value]) => `
    <article class="stat-card"><span>${label}</span><strong>${value}</strong></article>
  `).join("");
}

function countBy(rows, key, labels = {}) {
  return rows.reduce((acc, row) => {
    const label = labels[row[key]] || row[key] || "غير محدد";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function makeChart(id, counts, type) {
  const labels = Object.keys(counts);
  const data = Object.values(counts);
  new Chart(q(`#${id}`), {
    type,
    data: {
      labels: labels.length ? labels : ["لا توجد بيانات"],
      datasets: [{ data: data.length ? data : [1], backgroundColor: ["#C9A227", "#2563EB", "#16A34A", "#DC2626", "#64748B", "#9333EA", "#F59E0B"] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
  });
}
