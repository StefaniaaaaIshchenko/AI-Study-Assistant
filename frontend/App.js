// Уся логіка головної сторінки: вхід/вихід, AI-помічник, тест, прогрес, перехід до карток, оцінка сайту
(() => {
  const $ = (id) => document.getElementById(id);
  const API = "../backend/api.php";
  const call = async (action, body) => {
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action, ...body }) });
    let data = {}; try { data = await r.json(); } catch (e) {}
    return { ok: r.ok && data.success !== false, status: r.status, data };
  };
  const msgOf = (el, t, err) => { el.textContent = t; el.className = err ? "err" : ""; };

  /* ---------- Вхід / вихід ---------- */
  async function initAuth() {
    try {
      const { data } = await call("me");
      if (!data.logged_in) return null;
      const box = $("authBox"); box.replaceChildren();
      const hi = document.createElement("span"); hi.className = "hello"; hi.textContent = "Привіт, " + data.user.name;
      const out = document.createElement("button"); out.type = "button"; out.className = "ghost"; out.textContent = "Вийти";
      out.onclick = async () => { await call("logout"); location.reload(); };
      box.append(hi, out);
      return data.user;
    } catch (e) { return null; }
  }

  /* ---------- AI-помічник ---------- */
  const level = () => $("difficulty")?.value || "medium";
  const topic = () => $("question").value.trim();
  const MODES = {
    "Пояснити тему": ["explain", "aiResult"], "Згенерувати конспект": ["summary", "aiResult"], "Згенерувати тест": ["quiz", "aiResult"],
    "Створити план навчання": ["plan", "studyplan"], "Підготувати до іспиту": ["exam", "studyplan"],
  };
  function say(id, text, err, login) {
    const el = $(id); el.className = err ? "ai-out err" : "ai-out"; el.style.whiteSpace = "pre-wrap"; el.textContent = text;
    if (login) { const a = document.createElement("a"); a.href = "login.html"; a.textContent = " Увійти"; el.appendChild(a); }
  }
  async function run(mode, target, btn) {
    const t = target === "studyplan" ? ($("subjects").value.trim() || topic()) : topic();
    if (!t) return say(target, target === "studyplan" ? "Впиши предмети, які вчиш." : "Спочатку впиши тему або запитання в поле нижче.", true);
    btn.disabled = true; say(target, "AI працює над відповіддю…");
    try {
      const { ok, status, data } = await call("ai", { mode, topic: t, level: level() });
      if (status === 401) return say(target, data.message, true, true);
      if (!ok) return say(target, data.message || "Помилка. Спробуй ще раз.", true);
      if (mode === "quiz") { say(target, "Тест готовий — він нижче."); startQuiz(data.questions, t); } else say(target, data.text);
    } catch (e) { say(target, "Не вдалося зв'язатися із сервером.", true); }
    finally { btn.disabled = false; }
  }

  // Картки: перехід на окрему сторінку з темою (перехоплюємо раніше за інші обробники)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button"); if (!btn) return;
    if (btn.textContent.includes("флеш-картки")) {
      e.stopImmediatePropagation();
      const t = topic() || $("subjects")?.value.trim();
      if (!t) { $("question").focus(); $("question").placeholder = "Спочатку впиши тему, за якою зробити картки"; return; }
      sessionStorage.setItem("fcRequest", JSON.stringify({ topic: t, level: level() }));
      location.href = "flashcards.html"; return;
    }
    if (btn.id === "askBtn") return run("ask", "answer", btn);
    const m = MODES[btn.textContent.trim()]; if (m) run(m[0], m[1], btn);
  }, true);

  /* ---------- Тест і прогрес ---------- */
  let current = { qs: [], topic: "" };
  function startQuiz(qs, t) {
    current = { qs, topic: t };
    const box = $("quiz"); box.replaceChildren(); $("result-section").hidden = true;
    qs.forEach((q, i) => {
      const f = document.createElement("fieldset"); f.className = "q";
      const lg = document.createElement("legend"); lg.textContent = (i + 1) + ". " + q.q; f.appendChild(lg);
      q.options.forEach((o, j) => {
        const l = document.createElement("label"), r = document.createElement("input");
        r.type = "radio"; r.name = "q" + i; r.value = j; l.append(r, document.createTextNode(" " + o)); f.appendChild(l);
      });
      box.appendChild(f);
    });
    $("quiz-section").hidden = false; $("quiz-section").scrollIntoView({ behavior: "smooth" });
  }
  const showProgress = (d) => { $("testsDone").textContent = d.tests; $("testsAvg").textContent = d.average + "%"; };
  $("finish-quiz").addEventListener("click", async () => {
    let correct = 0;
    current.qs.forEach((q, i) => {
      const sel = document.querySelector(`input[name="q${i}"]:checked`), fs = $("quiz").children[i];
      fs.querySelector(".fb")?.remove();
      const ok = sel && +sel.value === q.correct; if (ok) correct++;
      const fb = document.createElement("p"); fb.className = "fb";
      fb.textContent = (ok ? "✓ Правильно. " : "✗ Правильна відповідь: " + q.options[q.correct] + ". ") + (q.explanation || ""); fs.appendChild(fb);
    });
    const total = current.qs.length;
    $("correct").textContent = correct + " з " + total; $("score").textContent = Math.round(correct / total * 100) + "%";
    $("result-section").hidden = false;
    const { ok, data } = await call("progress_save", { correct, total, topic: current.topic }); if (ok) showProgress(data);
  });

  /* ---------- Оцінка сайту ---------- */
  let value = 0;
  const paint = (v) => $("stars").querySelectorAll("button").forEach((b) => { b.classList.toggle("on", +b.dataset.v <= v); b.setAttribute("aria-checked", +b.dataset.v === v); });
  $("stars").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { value = +b.dataset.v; paint(value); } });
  function showRating(d) {
    $("rateSummary").textContent = d.count ? `Середня оцінка ${d.average} з 5 · відгуків: ${d.count}` : "Оцінок ще немає. Стань першим!";
    const ul = $("rateList"); ul.replaceChildren();
    d.recent.forEach((r) => {
      const li = document.createElement("li"), who = document.createElement("strong"), p = document.createElement("span");
      who.textContent = r.name + " · " + "★".repeat(r.stars); p.textContent = r.comment; li.append(who, p); ul.appendChild(li);
    });
    if (d.mine && !value) { value = d.mine.stars; paint(value); $("rateComment").value = d.mine.comment || ""; }
  }
  $("rateSend").addEventListener("click", async () => {
    if (!value) return msgOf($("rateMsg"), "Обери оцінку від 1 до 5 зірок", true);
    const { ok, status, data } = await call("rating_save", { stars: value, comment: $("rateComment").value });
    if (status === 401) return msgOf($("rateMsg"), "Щоб оцінити сайт, спочатку увійди в акаунт.", true);
    if (!ok) return msgOf($("rateMsg"), data.message || "Не вдалося надіслати", true);
    msgOf($("rateMsg"), "Дякуємо за оцінку!"); showRating(data);
  });

  /* ---------- Старт ---------- */
  (async () => {
    const user = await initAuth();
    try { showRating((await call("rating_get")).data); } catch (e) { $("rateSummary").textContent = ""; }
    if (user) { const { ok, data } = await call("progress_get"); if (ok) showProgress(data); }
  })();
})();
