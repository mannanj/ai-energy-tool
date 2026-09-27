(() => {
  const $ = (s) => document.querySelector(s);
  const main = $("#main"), input = $("#input"), form = $("#compose"), sendBtn = $("#send"), shareBtn = $("#share"), toolbar = $("#toolbar");
  const OPENING = "The rates for electricity have increased making it hard to make ends meet, what can I do?";
  const STARTERS = [
    OPENING,
    "I got a disconnection notice. What do I do?",
    "My bill went from $140 to $210. Why?",
    "I'm behind about $400 and I rent. Is there any help?",
    "Is there a program that lowers what I pay each month?",
    "Someone called saying they'll shut off my power in an hour unless I pay.",
  ];

  let chatId = null;
  let readOnly = false;

  const m = location.pathname.match(/^\/c\/([A-Za-z0-9]+)/);
  if (m) loadShared(m[1]); else showIntro();

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function showIntro() {
    const box = el("div", "intro");
    box.append(el("p", null, "Tell me what's going on with your electric bill. I'll ask a couple of short questions, then point you to the option that fits: a payment plan with Dominion, a program that lowers or pays part of the bill, or local help. Everything I say comes from a checked list of programs with the real phone numbers."));
    box.append(el("p", null, "If your power is off, you have a shutoff notice, or someone at home needs medical equipment that runs on electricity, say so first."));
    const chips = el("div", "chips");
    for (const s of STARTERS) { const c = el("button", "chip", s); c.type = "button"; c.onclick = () => { input.value = s; form.requestSubmit(); }; chips.append(c); }
    box.append(chips);
    main.append(box);
  }

  function bubble(role, text) {
    const wrap = el("div", "msg " + role);
    const b = el("div", "bubble");
    b.append(el("div", "who", role === "user" ? "You" : "Helper"));
    const body = el("div", "body", text || "");
    b.append(body);
    wrap.append(b);
    main.append(wrap);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    return { b, body };
  }

  async function loadShared(id) {
    readOnly = true;
    const r = await fetch("/api/chats/" + id);
    if (!r.ok) { main.append(el("p", "error", "That chat link doesn't exist on this server.")); form.style.display = "none"; return; }
    const c = await r.json();
    chatId = c.id;
    const banner = el("div", "readonly-banner");
    banner.append(el("div", null, "Saved chat" + (c.scenario ? " · scenario: " + c.scenario : "") + " · " + new Date(c.created_at).toLocaleString() + " · model " + c.model));
    const a = el("a", null, "Start your own chat"); a.href = "/";
    const t = el("a", null, "Plain text"); t.href = "/api/chats/" + id + ".txt"; t.style.marginLeft = "12px";
    banner.append(el("div", null, "")); banner.lastChild.append(a, t);
    main.append(banner);
    for (const msg of c.messages) bubble(msg.role, msg.content);
    input.placeholder = "Continue this chat…";
    readOnly = false; // continuing a shared chat appends to it; fine for a local demo
    setLink(c.link);
  }

  function setLink(link) {
    toolbar.innerHTML = "";
    const s = el("span", "link", link);
    const copy = el("button", null, "Copy link"); copy.type = "button";
    copy.onclick = async () => { try { await navigator.clipboard.writeText(link); copy.textContent = "Copied"; setTimeout(() => copy.textContent = "Copy link", 1500); } catch {} };
    toolbar.append(s, copy);
  }

  shareBtn.onclick = async () => {
    if (!chatId) { toolbar.innerHTML = ""; toolbar.append(el("span", "link", "Send a message first, then share.")); return; }
    const r = await fetch("/api/chats/" + chatId + "/share", { method: "POST" });
    const j = await r.json();
    setLink(j.link);
    try { await navigator.clipboard.writeText(j.link); } catch {}
    if (!location.pathname.startsWith("/c/")) history.replaceState(null, "", "/c/" + chatId);
  };

  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(160, input.scrollHeight) + "px"; });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    const intro = main.querySelector(".intro"); if (intro) intro.remove();
    input.value = ""; input.style.height = "auto";
    bubble("user", text);
    sendBtn.disabled = true;
    const { b, body } = bubble("assistant", "");
    b.classList.add("typing");
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId, message: text }) });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
          const ev = /^event: (.*)$/m.exec(chunk)?.[1]; const data = /^data: (.*)$/m.exec(chunk)?.[1];
          if (!ev || data == null) continue;
          const d = JSON.parse(data);
          if (ev === "meta") { chatId = d.chatId; if (!location.pathname.startsWith("/c/")) history.replaceState(null, "", "/c/" + chatId); }
          else if (ev === "delta") { body.textContent += d; window.scrollTo(0, document.body.scrollHeight); }
          else if (ev === "error") { body.append(el("div", "error", "Something went wrong: " + d.message + ". If this is urgent, call 2-1-1.")); }
        }
      }
    } catch (err) {
      body.append(el("div", "error", "Could not reach the helper: " + err.message + ". If this is urgent, call 2-1-1."));
    } finally {
      b.classList.remove("typing"); sendBtn.disabled = false; input.focus();
    }
  });
})();
