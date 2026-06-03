bootPage(async (profile) => {
  q("#profileForm").full_name.value = profile.full_name || "";
  q("#profileForm").phone.value = profile.phone || "";
  q("#profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const { error } = await db.from("profiles").update({
      full_name: values.full_name,
      phone: values.phone || null
    }).eq("id", profile.id);
    if (error) return showToast(error.message, "error");
    showToast("تم حفظ الملف الشخصي.");
  });
  q("#settingsLogoutBtn").addEventListener("click", logout);
});
