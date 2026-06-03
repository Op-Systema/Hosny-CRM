(async function redirectLoggedInFromAuthPages() {
  if (!location.pathname.includes("/auth/")) return;
  const { data } = await db.auth.getSession();
  if (data.session) window.location.replace("../dashboard.html");
})();

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = q("#loginForm");
  const signupForm = q("#signupForm");
  const forgotForm = q("#forgotForm");
  const message = q("#authMessage");

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthMessage("جاري تسجيل الدخول...");
    const form = new FormData(loginForm);
    const { error } = await db.auth.signInWithPassword({
      email: form.get("email"),
      password: form.get("password")
    });
    if (error) return setAuthMessage(error.message, "error");
    window.location.replace("../dashboard.html");
  });

  signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(signupForm);
    const password = form.get("password");
    if (password !== form.get("confirm_password")) {
      return setAuthMessage("كلمتا المرور غير متطابقتين.", "error");
    }
    setAuthMessage("جاري إنشاء الحساب...");
    const { error } = await db.auth.signUp({
      email: form.get("email"),
      password,
      options: { data: { full_name: form.get("full_name") } }
    });
    if (error) return setAuthMessage(error.message, "error");
    setAuthMessage("تم إنشاء الحساب. إذا كان تأكيد البريد مفعلا، راجع بريدك ثم سجل الدخول.", "success");
    signupForm.reset();
  });

  forgotForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(forgotForm);
    setAuthMessage("جاري إرسال الرابط...");
    const { error } = await db.auth.resetPasswordForEmail(form.get("email"), {
      redirectTo: `${location.origin}${location.pathname.replace("auth/forgot-password.html", "settings.html")}`
    });
    if (error) return setAuthMessage(error.message, "error");
    setAuthMessage("تم إرسال رابط إعادة التعيين إلى بريدك.", "success");
  });

  function setAuthMessage(text, type = "") {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`;
  }
});

async function logout() {
  await db.auth.signOut();
  window.location.replace(pathToRoot() + "auth/login.html");
}
