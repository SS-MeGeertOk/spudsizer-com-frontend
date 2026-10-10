/* ==========================================================
   Spudsizer – sign-up form + language switch.
   You normally don't need to edit this file.
   Settings (Worker address, Site key) are in config.js.
   ========================================================== */
(function () {
  const CONFIG = window.SPUDSIZER_CONFIG || {};
  const LANG = (document.documentElement.lang || "en").slice(0, 2) === "nl" ? "nl" : "en";

  const TEXT = {
    en: {
      name: "Please enter your name.",
      invalid_email: "Please enter a valid email address.",
      captcha_missing: "Please tick the box to confirm you are not a robot.",
      captcha_failed: "The robot check failed. Please tick the box again.",
      default: "Your details could not be sent. Please try again, or email info@spudsizer.nl.",
    },
    nl: {
      name: "Vul uw naam in.",
      invalid_email: "Vul een geldig e-mailadres in.",
      captcha_missing: "Vink het vakje aan om te bevestigen dat u geen robot bent.",
      captcha_failed: "De robotcontrole is mislukt. Vink het vakje opnieuw aan.",
      default: "Uw gegevens konden niet worden verzonden. Probeer het opnieuw of mail naar info@spudsizer.nl.",
    },
  }[LANG];

  // Remember the language a visitor picks, so the automatic Dutch redirect respects it
  document.querySelectorAll("[data-lang]").forEach((link) => {
    link.addEventListener("click", () => {
      try { localStorage.setItem("ss-lang", link.dataset.lang); } catch (e) {}
    });
  });

  // ---------- Turnstile (bot check) ----------
  let widgetId = null;
  window.onTurnstileLoad = function () {
    const box = document.getElementById("turnstile");
    if (!box || !window.turnstile) return;
    widgetId = window.turnstile.render(box, {
      sitekey: CONFIG.TURNSTILE_SITE_KEY,
      size: box.offsetWidth < 300 ? "compact" : "flexible",
      theme: "light",
      language: LANG,
    });
  };
  if (document.getElementById("turnstile")) {   // only on pages with the form
    const ts = document.createElement("script");
    ts.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
    ts.async = true;
    document.head.appendChild(ts);
  }

  // ---------- Form ----------
  const form = document.getElementById("lead-form");
  const thanks = document.getElementById("lead-thanks");
  if (!form) return;
  const errorEl = form.querySelector(".form-error");
  const button = form.querySelector(".submit-btn");
  const showError = (msg) => { errorEl.textContent = msg; };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");

    const name = form.elements.name;
    const email = form.elements.email;
    [name, email].forEach((f) => f.removeAttribute("aria-invalid"));
    if (!name.value.trim()) {
      name.setAttribute("aria-invalid", "true"); name.focus();
      return showError(TEXT.name);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      email.setAttribute("aria-invalid", "true"); email.focus();
      return showError(TEXT.invalid_email);
    }
    const token = form.querySelector('[name="cf-turnstile-response"]');
    if (!token || !token.value) return showError(TEXT.captcha_missing);

    button.disabled = true;
    try {
      const res = await fetch(CONFIG.WORKER_URL, { method: "POST", body: new FormData(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "default");
      form.hidden = true;
      thanks.hidden = false;
      thanks.focus();
    } catch (err) {
      showError(TEXT[err.message] || TEXT.default);
      if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
    } finally {
      button.disabled = false;
    }
  });
})();
