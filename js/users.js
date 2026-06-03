let users = [];
let userInvestors = [];

bootPage(async () => {
  await loadUsers();
  q("#usersTable").addEventListener("change", updateRole);
  q("#usersTable").addEventListener("click", toggleActive);
}, { adminOnly: true });

async function loadUsers() {
  [users, userInvestors] = await Promise.all([fetchProfiles(), fetchInvestors()]);
  renderUsers();
}

function renderUsers() {
  q("#usersTable").innerHTML = users.map((user) => {
    const total = userInvestors.filter((item) => item.assigned_to === user.id).length;
    return `
      <tr>
        <td><strong class="row-title">${escapeHtml(user.full_name || "-")}</strong><span class="row-sub">${escapeHtml(user.phone || "")}</span></td>
        <td>${escapeHtml(user.email)}</td>
        <td><select data-role="${user.id}"><option value="sales" ${user.role === "sales" ? "selected" : ""}>مبيعات</option><option value="admin" ${user.role === "admin" ? "selected" : ""}>مدير</option></select></td>
        <td><span class="status-badge ${user.is_active ? "status-green" : "status-red"}">${user.is_active ? "نشط" : "غير نشط"}</span></td>
        <td>${total}</td>
        <td><button class="${user.is_active ? "danger-btn" : "secondary-btn"}" data-active="${user.id}" data-value="${!user.is_active}" type="button">${user.is_active ? "تعطيل" : "تفعيل"}</button></td>
      </tr>
    `;
  }).join("");
}

async function updateRole(event) {
  const id = event.target.dataset.role;
  if (!id) return;
  const { error } = await db.from("profiles").update({ role: event.target.value }).eq("id", id);
  if (error) return showToast(error.message, "error");
  showToast("تم تحديث الدور.");
  await loadUsers();
}

async function toggleActive(event) {
  const id = event.target.dataset.active;
  if (!id) return;
  const { error } = await db.from("profiles").update({ is_active: event.target.dataset.value === "true" }).eq("id", id);
  if (error) return showToast(error.message, "error");
  showToast("تم تحديث حالة المستخدم.");
  await loadUsers();
}
