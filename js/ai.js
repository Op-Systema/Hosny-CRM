let aiProfile;
let aiInvestors = [];
let aiFollowups = [];
let aiMeetings = [];

const PROMPTS = ["ملخص اليوم", "المتابعات المتأخرة", "أقرب فرص للإغلاق", "رسالة متابعة واتساب"];

bootPage(async (profile) => {
  aiProfile = profile;
  q("#quickPrompts").innerHTML = PROMPTS.map((prompt) => `<button class="prompt-btn" type="button" data-prompt="${prompt}">${prompt}</button>`).join("");
  q("#quickPrompts").addEventListener("click", (event) => event.target.dataset.prompt && runPrompt(event.target.dataset.prompt));
  q("#chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const prompt = new FormData(event.currentTarget).get("prompt");
    event.currentTarget.reset();
    runPrompt(prompt);
  });
  await refreshAiData();
  appendChat("assistant", "أهلًا، اسألني عن المتابعات، الفرص القريبة، مراحل البيع، أو ملخص اليوم.");
});

async function refreshAiData() {
  const [investors, followupsRes, meetingsRes] = await Promise.all([
    fetchInvestors(),
    db.from("follow_ups").select("*, investor:investors(full_name,city,budget,score,pipeline_stage)").order("due_date"),
    db.from("meetings").select("*, investor:investors(full_name,score)").order("meeting_date", { ascending: false })
  ]);
  if (followupsRes.error) throw followupsRes.error;
  if (meetingsRes.error) throw meetingsRes.error;
  aiInvestors = investors;
  aiFollowups = followupsRes.data || [];
  aiMeetings = meetingsRes.data || [];
}

async function runPrompt(prompt) {
  appendChat("user", prompt);
  await refreshAiData();
  const response = answerPrompt(prompt);
  appendChat("assistant", response);
  await db.from("ai_logs").insert({ user_id: aiProfile.id, prompt, response });
}

function answerPrompt(prompt) {
  const text = prompt.toLowerCase();
  const now = new Date();
  const { start, end } = todayRange();
  const today = aiFollowups.filter((f) => f.status !== "done" && new Date(f.due_date) >= new Date(start) && new Date(f.due_date) < new Date(end));
  const overdue = aiFollowups.filter((f) => f.status !== "done" && new Date(f.due_date) < now);
  const closest = aiInvestors.filter((i) => ["negotiation", "approved", "contract_signed"].includes(i.pipeline_stage) || Number(i.score || 0) >= 80).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  if (text.includes("النهار") || text.includes("اليوم") || text.includes("ملخص")) {
    return `ملخص اليوم: لديك ${today.length} متابعات مستحقة، ${overdue.length} متابعات متأخرة، و${closest.length} فرص قريبة من الإغلاق. أعلى فرصة الآن: ${closest[0]?.full_name || "لا يوجد"}.`;
  }
  if (text.includes("متأخر")) {
    return overdue.length ? overdue.map((f) => `- ${f.investor?.full_name || "مستثمر"}: ${f.title} (${formatDate(f.due_date)})`).join("\n") : "لا توجد متابعات متأخرة.";
  }
  if (text.includes("أقرب") || text.includes("توقيع") || text.includes("إغلاق")) {
    return closest.length ? closest.slice(0, 6).map((i) => `- ${i.full_name}: ${STAGE_LABELS[i.pipeline_stage]}، الدرجة ${i.score}، الميزانية ${formatCurrency(i.budget)}.`).join("\n") : "لا توجد فرص قريبة من الإغلاق حتى الآن.";
  }
  if (text.includes("تفاوض")) {
    const negotiation = aiInvestors.filter((i) => i.pipeline_stage === "negotiation");
    return `عدد المستثمرين في مرحلة التفاوض: ${negotiation.length}. ${negotiation.map((i) => i.full_name).join("، ") || ""}`;
  }
  if (text.includes("واتساب") || text.includes("رسالة")) {
    const target = closest[0] || aiInvestors[0] || {};
    return generateWhatsAppMessage(target);
  }
  if (text.includes("الرياض")) {
    const rows = aiInvestors.filter((i) => (i.city || "").includes("رياض") || (i.interested_city || "").includes("رياض"));
    return rows.length ? rows.map((i) => `- ${i.full_name}: ${formatCurrency(i.budget)}، ${STAGE_LABELS[i.pipeline_stage]}.`).join("\n") : "لا يوجد مستثمرون مرتبطون بالرياض.";
  }
  if (text.includes("مليون")) {
    const rows = aiInvestors.filter((i) => Number(i.budget || 0) > 1000000);
    return rows.length ? rows.map((i) => `- ${i.full_name}: ${formatCurrency(i.budget)}، الدرجة ${i.score}.`).join("\n") : "لا يوجد مستثمرون بميزانية فوق مليون.";
  }
  return "أقدر أساعدك في: مين محتاج متابعة النهاردة، المتابعات المتأخرة، أقرب فرص للإغلاق، المستثمرين في الرياض، أو كتابة رسالة واتساب.";
}

function appendChat(type, text) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${type}`;
  bubble.textContent = text;
  q("#chatLog").appendChild(bubble);
  q("#chatLog").scrollTop = q("#chatLog").scrollHeight;
}
