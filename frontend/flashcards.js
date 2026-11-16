(() => {
  const API = "../backend/api.php";
  const $ = (id) => document.getElementById(id);
  const post = async (url, body) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
    let data = {}; try { data = await r.json(); } catch (e) {}
    return { ok: r.ok && data.success, status: r.status, data };
  };

  let set = { title: "", topic: "", cards: [] };
  let idx = 0, dragDx = 0;
  const LEVELS = { beginner: "початковий рівень", medium: "середній рівень", advanced: "просунутий рівень" };

  const status = (msg, err) => { $("status").textContent = msg || ""; $("status").className = err ? "err" : ""; };
  const show = (on) => ["stage", "controls", "actions"].forEach((id) => ($(id).hidden = !on));

  /* ---------- Рендер каруселі ---------- */
  function buildCard(c, i) {
    const slot = document.createElement("div");
    slot.className = "slot"; slot.dataset.i = i;

    const card = document.createElement("div");
    card.className = "card"; card.setAttribute("role", "button");
    card.setAttribute("aria-label", "Картка: " + c.front + ". Натисни, щоб перевернути");

    const front = document.createElement("div"); front.className = "face";
    const art = document.createElement("div"); art.className = "art"; art.textContent = c.emoji || "💡";
    const term = document.createElement("div"); term.className = "term";
    const h = document.createElement("h3"); h.textContent = c.front;
    term.appendChild(h);
    if (c.hint) { const p = document.createElement("p"); p.textContent = "Підказка: " + c.hint; term.appendChild(p); }
    const tip = document.createElement("span"); tip.className = "flip-tip"; tip.textContent = "Перевернути";
    front.append(art, term, tip);

    const back = document.createElement("div"); back.className = "face back";
    const ans = document.createElement("p"); ans.className = "answer"; ans.textContent = c.back;
    back.appendChild(ans);
    if (c.mnemonic) {
      const a = document.createElement("div"); a.className = "assoc";
      const b = document.createElement("b"); b.textContent = (c.emoji ? c.emoji + " " : "") + "Асоціація";
      a.append(b, document.createTextNode(c.mnemonic)); back.appendChild(a);
    }
    card.append(front, back); slot.appendChild(card);
    if (c.image_query) loadImage(c.image_query, art);
    return slot;
  }

  async function loadImage(q, art) {
    try {
      const r = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(q));
      if (!r.ok) return;
      const src = (await r.json()).thumbnail?.source;
      if (!src) return;
      const img = new Image();
      img.onload = () => { art.style.backgroundImage = `url("${src}")`; art.classList.add("has-img"); art.textContent = ""; };
      img.src = src;
    } catch (e) { /* лишаємо емодзі */ }
  }

  function render() {
    const deck = $("deck"); deck.replaceChildren(...set.cards.map(buildCard));
    idx = 0; position();
    $("setTitle").textContent = set.title || set.topic;
    $("setMeta").textContent = set.cards.length + " карток" + (set.level ? " · " + LEVELS[set.level] : "");
    show(true);
  }

  function position() {
    const slots = [...$("deck").children];
    slots.forEach((s, i) => {
      const d = i - idx, a = Math.abs(d), w = s.offsetWidth;
      const x = d * w * 0.64 + dragDx;
      s.style.transform = `translateX(${x}px) translateY(${a * 22}px) scale(${1 - a * 0.1}) rotate(${d * 5}deg)`;
      s.style.opacity = a > 2 ? 0 : [1, 0.85, 0.4][a];
      s.style.zIndex = 10 - a;
      s.style.pointerEvents = a > 2 ? "none" : "auto";
      const card = s.firstChild;
      card.tabIndex = d === 0 ? 0 : -1;
      if (d !== 0) card.classList.remove("flipped");
    });
    $("counter").textContent = (idx + 1) + " / " + slots.length;
  }

  const go = (i) => { idx = Math.max(0, Math.min(set.cards.length - 1, i)); dragDx = 0; position(); };
  const flip = () => $("deck").children[idx]?.firstChild.classList.toggle("flipped");

  /* ---------- Перетягування / тап ---------- */
  const stage = $("stage");
  let startX = null, moved = false, downSlot = null;
  stage.addEventListener("pointerdown", (e) => { startX = e.clientX; moved = false; downSlot = e.target.closest(".slot"); stage.setPointerCapture(e.pointerId); });
  stage.addEventListener("pointermove", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 6) { moved = true; stage.classList.add("dragging", "touched"); }
    if (moved) { dragDx = dx; [...$("deck").children].forEach((s) => s.classList.add("dragging-now")); position(); }
  });
  const end = (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX; startX = null;
    stage.classList.remove("dragging");
    [...$("deck").children].forEach((s) => s.classList.remove("dragging-now"));
    if (moved) { go(dx < -50 ? idx + 1 : dx > 50 ? idx - 1 : idx); }
    else if (downSlot) { const i = +downSlot.dataset.i; i === idx ? flip() : go(i); }
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);

  $("prev").onclick = () => go(idx - 1);
  $("next").onclick = () => go(idx + 1);
  document.addEventListener("keydown", (e) => {
    if (document.querySelector("dialog[open]") || $("stage").hidden) return;
    if (e.key === "ArrowRight") go(idx + 1);
    else if (e.key === "ArrowLeft") go(idx - 1);
    else if ((e.key === " " || e.key === "Enter") && document.activeElement === $("deck").children[idx]?.firstChild) { e.preventDefault(); flip(); }
  });
  window.addEventListener("resize", position);

  $("shuffle").onclick = () => {
    for (let i = set.cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [set.cards[i], set.cards[j]] = [set.cards[j], set.cards[i]]; }
    render();
  };

  /* ---------- Генерація ---------- */
  async function generate(req) {
    show(false); $("setTitle").textContent = "Створюю картки…"; $("setMeta").textContent = req.topic;
    status("AI готує картки за темою «" + req.topic + "». Це займе кілька секунд.");
    try {
      const { ok, data } = await post(API, { action: "flashcards", topic: req.topic, level: req.level, count: 10, material_id: req.material_id || 0 });
      if (!ok) throw new Error(data.message || "Помилка генерації");
      set = { title: data.title, topic: req.topic, level: req.level, material_id: req.material_id || 0, cards: data.cards };
      sessionStorage.setItem("fcSet", JSON.stringify(set));
      status(""); render();
    } catch (e) {
      $("setTitle").textContent = "Не вдалося створити картки";
      status(e.message + " Натисни «Згенерувати нові», щоб спробувати знову.", true);
      $("actions").hidden = false; ["saveBtn", "shuffle"].forEach((id) => ($(id).hidden = true));
    }
  }
  $("regen").onclick = () => {
    ["saveBtn", "shuffle"].forEach((id) => ($(id).hidden = false));
    const req = JSON.parse(sessionStorage.getItem("fcRequest") || "null");
    if (req) { sessionStorage.removeItem("fcSet"); generate(req); }
    else status("Тему задають на головній сторінці. Повернись і впиши її.", true);
  };

  /* ---------- Збереження в колекцію ---------- */
  const dlg = $("saveDialog");
  const msg = (t, err) => { $("saveMsg").textContent = t || ""; $("saveMsg").className = err ? "err" : ""; };

  $("saveBtn").onclick = async () => {
    msg(""); $("saveConfirm").disabled = false;
    const sel = $("colSelect"); sel.replaceChildren();
    const { ok, status: st, data } = await post(API, { action: "col_list" });
    if (st === 401) { msg("Щоб зберігати колекції, спочатку увійди в акаунт.", true); $("saveConfirm").disabled = true; }
    else if (!ok) msg(data.message || "Не вдалося завантажити колекції", true);
    (data.collections || []).forEach((c) => sel.add(new Option(`${c.name} (${c.cards})`, c.id)));
    sel.add(new Option("+ Створити колекцію", "new"));
    if (!(data.collections || []).length) sel.value = "new";
    $("newColName").value = set.title || set.topic;
    toggleNew(); dlg.showModal();
  };
  const toggleNew = () => ($("newColWrap").hidden = $("colSelect").value !== "new");
  $("colSelect").onchange = toggleNew;
  $("saveCancel").onclick = () => dlg.close();

  $("saveForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const isNew = $("colSelect").value === "new";
    const name = $("newColName").value.trim();
    if (isNew && !name) return msg("Введи назву колекції", true);
    $("saveConfirm").disabled = true; msg("Зберігаю…");
    const { ok, data } = await post(API, { action: "col_save", collection_id: isNew ? 0 : +$("colSelect").value, new_name: name, topic: set.topic, cards: set.cards });
    $("saveConfirm").disabled = false;
    if (!ok) return msg(data.message || "Не вдалося зберегти", true);
    msg("Збережено ✓"); setTimeout(() => dlg.close(), 900);
  });

  /* ---------- Мої колекції ---------- */
  const cdlg = $("colDialog");
  async function openCollections() {
    const list = $("colList"); list.replaceChildren(); $("colMsg").textContent = "";
    cdlg.showModal();
    const { ok, status: st, data } = await post(API, { action: "col_list" });
    if (st === 401) { $("colMsg").textContent = "Увійди в акаунт, щоб бачити свої колекції."; return; }
    if (!ok) { $("colMsg").textContent = data.message || "Помилка завантаження"; return; }
    if (!data.collections.length) { $("colMsg").textContent = "Колекцій ще немає. Збережи перший набір карток."; return; }
    data.collections.forEach((c) => {
      const li = document.createElement("li");
      const name = document.createElement("span"); name.className = "name"; name.textContent = c.name;
      const cnt = document.createElement("span"); cnt.className = "count"; cnt.textContent = c.cards + " карток";
      const open = document.createElement("button"); open.type = "button"; open.textContent = "Вчити";
      open.onclick = () => openSaved(c.id);
      const del = document.createElement("button"); del.type = "button"; del.className = "ghost"; del.textContent = "Видалити";
      del.onclick = async () => { if (confirm("Видалити колекцію «" + c.name + "»?")) { await post(API, { action: "col_delete", collection_id: c.id }); openCollections(); } };
      li.append(name, cnt, open, del); list.appendChild(li);
    });
  }
  async function openSaved(id) {
    const { ok, data } = await post(API, { action: "col_get", collection_id: id });
    if (!ok) { $("colMsg").textContent = data.message || "Не вдалося відкрити"; return; }
    set = { title: data.title, topic: data.title, cards: data.cards };
    cdlg.close(); status(""); render();
  }
  $("openCollections").onclick = openCollections;
  $("colClose").onclick = () => cdlg.close();

  /* ---------- Старт ---------- */
  const req = JSON.parse(sessionStorage.getItem("fcRequest") || "null");
  const cached = JSON.parse(sessionStorage.getItem("fcSet") || "null");
  if (req && cached && cached.topic === req.topic && (cached.material_id || 0) === (req.material_id || 0) && cached.cards?.length) { set = cached; render(); }
  else if (req) generate(req);
  else {
    $("setTitle").textContent = "Тему ще не вказано";
    status("Впиши тему в розділі «AI-помічник» на головній і натисни «Згенерувати флеш-картки». Або відкрий збережену колекцію.");
  }
})();
