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
    const useMat = material.id;   // якщо матеріал обрано, AI спирається на нього
    if (!t && !useMat) return say(target, target === "studyplan" ? "Впиши предмети, які вчиш, або обери матеріал." : "Спочатку впиши тему або запитання в поле нижче, або обери матеріал.", true);
    btn.disabled = true; say(target, "AI працює над відповіддю…");
    try {
      const { ok, status, data } = await call("ai", { mode, topic: t, level: level(), material_id: useMat || 0 });
      if (status === 401) return say(target, data.message, true, true);
      if (!ok) return say(target, data.message || "Помилка. Спробуй ще раз.", true);
      if (mode === "quiz") { say(target, "Тест готовий — він нижче."); startQuiz(data.questions, t || material.name); } else say(target, data.text);
    } catch (e) { say(target, "Не вдалося зв'язатися із сервером.", true); }
    finally { btn.disabled = false; }
  }

  // Картки: перехід на окрему сторінку з темою (перехоплюємо раніше за інші обробники)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button"); if (!btn) return;
    if (btn.textContent.includes("флеш-картки")) {
      e.stopImmediatePropagation();
      const t = topic() || $("subjects")?.value.trim() || material.name;
      if (!t) { $("question").focus(); $("question").placeholder = "Спочатку впиши тему або обери матеріал, за яким зробити картки"; return; }
      sessionStorage.setItem("fcRequest", JSON.stringify({ topic: t, level: level(), material_id: material.id || 0 }));
      location.href = "flashcards.html"; return;
    }
    if (btn.id === "askBtn") return run("ask", "answer", btn);
    const m = MODES[btn.textContent.trim()]; if (m) run(m[0], m[1], btn);
  }, true);

  /* ---------- Навчальні матеріали ---------- */
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  let material = { id: 0, name: "" };
  try { material = JSON.parse(sessionStorage.getItem("material")) || material; } catch (e) {}
  const matMsg = (t, err) => msgOf($("matMsg"), t, err);

  function loadPdfJs() {   // бібліотека PDF підвантажується лише тоді, коли вона потрібна
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise((res, rej) => {
      const sc = document.createElement("script"); sc.src = PDFJS + "pdf.min.js";
      sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; res(window.pdfjsLib); };
      sc.onerror = () => rej(new Error("Не вдалося завантажити модуль читання PDF. Перевір інтернет."));
      document.head.appendChild(sc);
    });
  }
  async function readFile(file) {   // повертає { text, pages }
    if (/\.txt$/i.test(file.name) || file.type === "text/plain") return { text: await file.text(), pages: 0 };
    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    const n = Math.min(pdf.numPages, 300); let text = "";
    for (let i = 1; i <= n; i++) {
      matMsg(`Читаю сторінку ${i} з ${n}…`);
      const tc = await (await pdf.getPage(i)).getTextContent();
      text += tc.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join("") + "\n\n";
    }
    return { text: text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(), pages: pdf.numPages };
  }

  function useMaterial(m) {
    material = m ? { id: +m.id, name: m.name } : { id: 0, name: "" };
    sessionStorage.setItem("material", JSON.stringify(material));
    const u = $("matUsing"); u.replaceChildren();
    if (material.id) { const b = document.createElement("b"); b.textContent = material.name; u.append("Працюємо з матеріалом: ", b, ". Тему можна уточнити в полі нижче або залишити порожньою."); }
    else u.textContent = "Матеріал не обрано: AI відповідає за темою з поля нижче.";
    $("matList").querySelectorAll("li").forEach((li) => li.classList.toggle("active", +li.dataset.id === material.id));
  }

  async function loadMaterials(logged) {
    const ul = $("matList"); ul.replaceChildren();
    if (!logged) { matMsg("Увійди в акаунт, щоб завантажувати матеріали."); useMaterial(null); return; }
    const { ok, data } = await call("mat_list");
    if (!ok) return matMsg(data.message || "Не вдалося завантажити список матеріалів", true);
    const items = [{ id: 0, name: "Без матеріалу (лише тема)" }, ...data.materials];
    items.forEach((m) => {
      const li = document.createElement("li"); li.dataset.id = m.id;
      const lb = document.createElement("label"), r = document.createElement("input"), nm = document.createElement("strong");
      r.type = "radio"; r.name = "material"; r.checked = +m.id === material.id; r.onchange = () => useMaterial(+m.id ? m : null);
      nm.textContent = m.name; lb.append(r, nm);
      if (+m.id) {
        const info = document.createElement("small");
        info.textContent = (m.pages ? m.pages + " стор. · " : "") + (m.chars < 1000 ? m.chars + " символів" : Math.round(m.chars / 1000) + " тис. символів");
        lb.appendChild(info);
      }
      li.appendChild(lb);
      if (+m.id) {
        const del = document.createElement("button"); del.type = "button"; del.className = "ghost"; del.textContent = "Видалити";
        del.onclick = async () => {
          if (!confirm("Видалити матеріал «" + m.name + "»?")) return;
          await call("mat_delete", { material_id: m.id });
          if (material.id === +m.id) useMaterial(null);
          loadMaterials(true);
        };
        li.appendChild(del);
      }
      ul.appendChild(li);
    });
    if (material.id && !data.materials.some((m) => +m.id === material.id)) useMaterial(null); else useMaterial(material.id ? material : null);
  }

  $("matUpload").addEventListener("click", async (e) => {
    const btn = e.currentTarget, file = $("matFile").files[0];
    if (!file) return matMsg("Спочатку обери файл PDF або TXT.", true);
    if (!/\.(pdf|txt)$/i.test(file.name)) return matMsg("Підтримуються лише файли PDF і TXT.", true);
    if (file.size > 20 * 1024 * 1024) return matMsg("Файл завеликий (максимум 20 МБ).", true);
    btn.disabled = true; matMsg("Читаю файл…");
    try {
      const { text, pages } = await readFile(file);
      if (text.length < 20) return matMsg("У файлі не знайдено тексту. Схоже, це скан: потрібен PDF із текстовим шаром.", true);
      matMsg("Зберігаю…");
      const { ok, status, data } = await call("mat_save", { name: file.name.replace(/\.(pdf|txt)$/i, ""), content: text.slice(0, 300000), pages });
      if (status === 401) return matMsg("Увійди в акаунт, щоб завантажувати матеріали.", true);
      if (!ok) return matMsg(data.message || "Не вдалося зберегти", true);
      matMsg(text.length > 300000 ? "Збережено (файл дуже великий, тому взято перші 300 тис. символів)." : "Матеріал збережено ✓");
      $("matFile").value = "";
      material = { id: data.material_id, name: file.name.replace(/\.(pdf|txt)$/i, "") };
      await loadMaterials(true);
    } catch (err) { matMsg(err.message || "Не вдалося прочитати файл", true); }
    finally { btn.disabled = false; }
  });

  /* ---------- Тест і прогрес ---------- */
  let current = { qs: [], topic: "" };
  function startQuiz(qs, t) {
    current = { qs, topic: t, saved: false }; $("finish-quiz").disabled = false;
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
    if (current.saved || !current.qs.length) return;
    const unanswered = current.qs.filter((q, i) => !document.querySelector(`input[name="q${i}"]:checked`)).length;
    if (unanswered && !confirm(`Без відповіді залишилось питань: ${unanswered}. Завершити тест?`)) return;
    current.saved = true; $("finish-quiz").disabled = true;
    $("quiz").querySelectorAll("input").forEach((r) => (r.disabled = true));
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
    loadMaterials(!!user);
    try { showRating((await call("rating_get")).data); } catch (e) { $("rateSummary").textContent = ""; }
    if (user) { $("progressHint").hidden = true; const { ok, data } = await call("progress_get"); if (ok) showProgress(data); }
  })();
})();
