let pipelineInvestors = [];
let overdueInvestorIds = new Set();

bootPage(async () => {
  await loadPipeline();
});

async function loadPipeline() {
  const [investors, followupsRes] = await Promise.all([
    fetchInvestors(),
    db.from("follow_ups").select("investor_id,due_date,status").neq("status", "done")
  ]);
  if (followupsRes.error) throw followupsRes.error;
  pipelineInvestors = investors;
  overdueInvestorIds = new Set((followupsRes.data || []).filter((item) => new Date(item.due_date) < new Date()).map((item) => item.investor_id));
  renderPipeline();
}

function renderPipeline() {
  q("#pipelineBoard").innerHTML = STAGES.map(([stage, label]) => {
    const cards = pipelineInvestors.filter((item) => item.pipeline_stage === stage);
    return `
      <section class="kanban-column" data-stage="${stage}">
        <h2>${label}<span class="status-badge status-blue">${cards.length}</span></h2>
        ${cards.map(cardHtml).join("") || '<div class="empty-state">لا توجد فرص</div>'}
      </section>
    `;
  }).join("");
  qa(".kanban-card").forEach((card) => {
    card.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", card.dataset.id));
  });
  qa(".kanban-column").forEach((column) => {
    column.addEventListener("dragover", (event) => event.preventDefault());
    column.addEventListener("drop", updateStage);
  });
}

function cardHtml(item) {
  return `
    <article class="kanban-card ${overdueInvestorIds.has(item.id) ? "overdue" : ""}" draggable="true" data-id="${item.id}">
      <a href="investor-details.html?id=${item.id}"><strong class="row-title">${escapeHtml(item.full_name)}</strong></a>
      <span class="row-sub">${escapeHtml(item.city || "بدون مدينة")} · ${formatCurrency(item.budget)}</span>
      <div class="actions-row">${renderScoreBadge(item.score)}<span class="row-sub">${formatDate(item.last_contacted_at)}</span></div>
    </article>
  `;
}

async function updateStage(event) {
  event.preventDefault();
  const id = event.dataTransfer.getData("text/plain");
  const stage = event.currentTarget.dataset.stage;
  const now = new Date().toISOString();
  const { error } = await db.from("investors").update({ pipeline_stage: stage, updated_at: now }).eq("id", id);
  if (error) return showToast(error.message, "error");
  showToast("تم تحديث مرحلة المستثمر.");
  await loadPipeline();
}
