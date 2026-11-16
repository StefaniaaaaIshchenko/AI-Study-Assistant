// Вступ: відео перемотується скролом, наприкінці плавно відкривається сайт
(function () {
  var intro = document.getElementById('intro') || document.querySelector('.intro');
  if (!intro) return;

  var video = document.getElementById('introVideo');
  var copy = document.getElementById('introCopy');
  var hint = document.getElementById('scrollHint');
  var skip = document.getElementById('introSkip');
  var stage = intro.querySelector('.intro-stage');

  var forced = location.search.indexOf('intro') !== -1;      // index.html?intro  – показати знову
  var seen = false;
  try { seen = sessionStorage.getItem('introSeen') === '1'; } catch (e) {}
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if ((seen && !forced) || reduce) { intro.remove(); return; }

  function markSeen() { try { sessionStorage.setItem('introSeen', '1'); } catch (e) {} }
  function goToSite() {
    markSeen();
    var end = intro.offsetTop + intro.offsetHeight;
    window.scrollTo({ top: end, behavior: 'smooth' });
  }
  skip.addEventListener('click', goToSite);
  // якщо відео не завантажилось – просто показуємо сайт без вступу
  video.addEventListener('error', function () { if (video.src) intro.remove(); });

  // Завантажуємо відео повністю в пам'ять: перемотування з пам'яті значно плавніше, ніж зі стрімінгу
  var url = video.getAttribute('data-src');
  function useDirect() { video.src = url; unlock(); }
  function unlock() {   // iOS/Safari: "розблокувати" відео для перемотування
    var p = video.play();
    if (p && p.then) p.then(function () { video.pause(); video.currentTime = 0; }).catch(function () {});
  }
  fetch(url)
    .then(function (r) { if (!r.ok) throw new Error('video'); return r.blob(); })
    .then(function (b) { video.src = URL.createObjectURL(b); unlock(); })
    .catch(useDirect);

  var VIDEO_PART = 0.85, FADE_START = 0.93;
  var current = 0;
  function clamp(v) { return Math.min(1, Math.max(0, v)); }

  function frame() {
    var total = intro.offsetHeight - window.innerHeight;
    var target = clamp(-intro.getBoundingClientRect().top / total);
    current += (target - current) * 0.1;                     // плавне наздоганяння

    // Відео займає перші 85% скролу, потім короткий "доліст" на останньому кадрі, і лише тоді плавний вихід у сайт
    var videoP = clamp(current / VIDEO_PART);
    if (video.duration && !video.seeking) {
      var t = videoP * (video.duration - 0.05);
      if (Math.abs(video.currentTime - t) > 0.02) video.currentTime = t;
    }

    var o = clamp(1 - current * 6);                           // текст зникає на початку
    copy.style.opacity = o;
    hint.style.opacity = o;
    stage.style.opacity = current > FADE_START ? clamp(1 - (current - FADE_START) / (1 - FADE_START)) : 1;

    if (current > 0.97) markSeen();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
