// Spudsizer lead form handler (Cloudflare Worker)
// 1. Checks the request comes from the Spudsizer website
// 2. Drops bots via a hidden honeypot field + Cloudflare Turnstile
// 3. Emails the lead to every address in TO_EMAILS (via Resend)

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const reply = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405);
    if (!allowed.includes(origin)) return reply({ ok: false, error: "forbidden_origin" }, 403);

    let form;
    try { form = await request.formData(); } catch { return reply({ ok: false, error: "bad_request" }, 400); }

    // Honeypot: real people never see or fill this field. Pretend success so bots don't retry.
    if ((form.get("website") || "").toString().trim() !== "") return reply({ ok: true });

    // Turnstile verification
    const token = (form.get("cf-turnstile-response") || "").toString();
    if (!token) return reply({ ok: false, error: "captcha_missing" }, 400);
    const verifyBody = new FormData();
    verifyBody.append("secret", env.TURNSTILE_SECRET);
    verifyBody.append("response", token);
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) verifyBody.append("remoteip", ip);
    const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: verifyBody });
    const outcome = await verify.json();
    if (!outcome.success) return reply({ ok: false, error: "captcha_failed" }, 403);

    // Collect every form field (add/rename fields in the HTML without touching this code)
    const skip = new Set(["website", "cf-turnstile-response"]);
    const fields = [];
    for (const [key, value] of form.entries()) {
      if (skip.has(key) || typeof value !== "string") continue;
      if (fields.length >= 30) break;
      fields.push([key.slice(0, 60), value.trim().slice(0, 5000)]);
    }
    const get = k => (fields.find(([key]) => key.toLowerCase() === k) || [])[1] || "";
    const email = get("email");
    const name = get("name") || get("naam");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ ok: false, error: "invalid_email" }, 400);

    const text =
      "Nieuwe aanvraag via het contactformulier op de website:\n\n" +
      fields.map(([k, v]) => `${k}: ${v}`).join("\n") +
      `\n\n---\nVerzonden: ${new Date().toISOString()}\nPagina: ${request.headers.get("Referer") || "onbekend"}`;

    const to = (env.TO_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);
    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.FROM_EMAIL, to, reply_to: email, subject: `Nieuwe lead: ${name || email}`, text }),
    });
    if (!send.ok) {
      console.error("Resend error", send.status, await send.text());
      return reply({ ok: false, error: "send_failed" }, 502);
    }
    return reply({ ok: true });
  },
};
