/* ==========================================================
   Spudsizer – sign-up form
   Fill in these two values after setting up Cloudflare:
   ========================================================== */
const CONFIG = {
  // URL printed by `npx wrangler deploy` (step 7 of the guide)
  WORKER_URL: "https://spudsizer-leads.geertvanmaldegem.workers.dev",
  // Turnstile "Site key" (Cloudflare dashboard → Turnstile).
  // The value below is Cloudflare's public test key: it always passes, so the page works before setup.
  TURNSTILE_SITE_KEY: "0x4AAAAAAFPlYaKSjhrtp24N",
};

let turnstileWidgetId = null;

// Called by the Turnstile script once it has loaded
window.onTurnstileLoad = function () {
  const box = document.getElementById("turnstile");
  if (!box || !window.turnstile) return;
  turnstileWidgetId = window.turnstile.render(box, {
    sitekey: CONFIG.TURNSTILE_SITE_KEY,
    size: box.offsetWidth < 300 ? "compact" : "flexible",
    theme: "light",
    language: "en",
  });
};

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("lead-form");
  const thanks = document.getElementById("lead-thanks");
  if (!form) return;
  const errorEl = form.querySelector(".form-error");
  const button = form.querySelector(".submit-btn");

  const showError = (msg) => { errorEl.textContent = msg; };

  const messages = {
    captcha_missing: "Please tick the box to confirm you are not a robot.",
    captcha_failed: "The robot check failed. Please tick the box again.",
    invalid_email: "Please enter a valid email address.",
    default: "Your details could not be sent. Please try again, or email info@spudsizer.nl.",
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");

    // Field checks
    const name = form.elements.name;
    const email = form.elements.email;
    [name, email].forEach((f) => f.removeAttribute("aria-invalid"));
    if (!name.value.trim()) {
      name.setAttribute("aria-invalid", "true"); name.focus();
      return showError("Please enter your name.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      email.setAttribute("aria-invalid", "true"); email.focus();
      return showError(messages.invalid_email);
    }
    const token = form.querySelector('[name="cf-turnstile-response"]');
    if (!token || !token.value) return showError(messages.captcha_missing);

    button.disabled = true;
    try {
      const res = await fetch(CONFIG.WORKER_URL, { method: "POST", body: new FormData(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "default");
      form.hidden = true;
      thanks.hidden = false;
      thanks.focus();
    } catch (err) {
      showError(messages[err.message] || messages.default);
      if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
    } finally {
      button.disabled = false;
    }
  });
});
