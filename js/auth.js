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
  const resendConfirmationBtn = q("#resendConfirmationBtn");
  let lastAuthEmail = "";

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    resendConfirmationBtn?.classList.add("hidden");
    setAuthMessage("جاري تسجيل الدخول...");
    const form = new FormData(loginForm);
    lastAuthEmail = String(form.get("email") || "").trim();
    const { error } = await db.auth.signInWithPassword({
      email: lastAuthEmail,
      password: form.get("password")
    });
    if (error) {
      const translated = translateAuthError(error.message);
      if (isEmailConfirmationError(error.message)) resendConfirmationBtn?.classList.remove("hidden");
      return setAuthMessage(translated, "error");
    }
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
    lastAuthEmail = String(form.get("email") || "").trim();
    const { data, error } = await db.auth.signUp({
      email: lastAuthEmail,
      password,
      options: { data: { full_name: form.get("full_name") } }
    });
    if (error) return setAuthMessage(translateAuthError(error.message), "error");
    if (data.session) {
      window.location.replace("../dashboard.html");
      return;
    }
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

  resendConfirmationBtn?.addEventListener("click", async () => {
    const email = lastAuthEmail || String(new FormData(loginForm).get("email") || "").trim();
    if (!email) return setAuthMessage("اكتب البريد الإلكتروني أولًا ثم اضغط إعادة الإرسال.", "error");
    setAuthMessage("جاري إرسال رسالة التفعيل...");
    const { error } = await db.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${location.origin}${location.pathname.replace("auth/login.html", "dashboard.html")}` }
    });
    if (error) return setAuthMessage(translateAuthError(error.message), "error");
    setAuthMessage("تم إرسال رسالة التفعيل. افتح البريد واضغط رابط التفعيل ثم سجل الدخول.", "success");
  });

  function setAuthMessage(text, type = "") {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`;
  }
});

function isEmailConfirmationError(message = "") {
  return message.toLowerCase().includes("email not confirmed") || message.toLowerCase().includes("not confirmed");
}

function translateAuthError(message = "") {
  const lower = message.toLowerCase();
  if (isEmailConfirmationError(message)) return "البريد الإلكتروني لم يتم تفعيله بعد. راجع رسالة التفعيل أو اضغط إعادة إرسال.";
  if (lower.includes("email logins are disabled") || lower.includes("email provider is disabled")) return "تسجيل الدخول بالبريد غير مفعل في Supabase. فعّل Email Provider من إعدادات Authentication.";
  if (lower.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (lower.includes("user already registered")) return "هذا البريد مسجل بالفعل. جرّب تسجيل الدخول أو استعادة كلمة المرور.";
  if (lower.includes("password")) return "راجع كلمة المرور. يجب أن تكون صحيحة ومطابقة لشروط Supabase.";
  if (lower.includes("rate limit")) return "تمت محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
  return message || "حدث خطأ في عملية الدخول.";
}

async function logout() {
  await db.auth.signOut();
  window.location.replace(pathToRoot() + "auth/login.html");
}
