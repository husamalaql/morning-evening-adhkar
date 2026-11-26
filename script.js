(() => {
  "use strict";

  const DATA_URL = "data/adhkar.json";
  const sectionButtons = document.querySelectorAll("[data-section]");
  const settingsButton = document.getElementById("settings-button");
  const backdrop = document.getElementById("dialog-backdrop");
  const closeButton = document.getElementById("dialog-close");
  const title = document.getElementById("dialog-title");
  const symbol = document.getElementById("dialog-symbol");
  const dialogBody = document.getElementById("dialog-body");
  const state = { data: null, section: null, items: [], index: 0, count: 0, audioIndex: 0, audioSources: [], audio: null };

  const toArabicNumber = (value) => String(value).replace(/\d/g, digit => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));

  function openDialog() {
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    closeButton.focus();
  }

  function stopAudio() {
    if (state.audio) {
      state.audio.pause();
      state.audio.removeAttribute("src");
      state.audio.load();
    }
    state.audio = null;
    state.audioSources = [];
    state.audioIndex = 0;
  }

  function closeDialog() {
    stopAudio();
    backdrop.hidden = true;
    document.body.style.overflow = "";
  }

  function render() {
    const item = state.items[state.index];
    if (!item) return;
    stopAudio();
    state.count = 0;
    title.textContent = state.section === "morning" ? "أذكار الصباح" : "أذكار المساء";
    symbol.textContent = state.section === "morning" ? "☀" : "☾";
    const countLabel = item.count > 1
      ? `<span class="dhikr-count-label">التكرار: ${toArabicNumber(item.count)} مرات</span>`
      : '<span class="dhikr-count-label">مرة واحدة</span>';
    const audio = item.audio?.sources?.length || item.audio?.src
      ? `<section class="audio-panel"><div class="audio-heading"><span>الاستماع إلى الذكر</span><small>${escapeHtml(item.audio.label || "تسجيل صوتي")}</small></div><audio id="dhikr-audio" controls preload="none"></audio><p class="audio-note">يمكنك الاستماع ثم قراءة الذكر بنفسك.</p></section>`
      : "";
    const source = item.sourceUrl
      ? `<a class="source-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">المصدر والتخريج</a>`
      : "";
    dialogBody.innerHTML = `
      <div class="dhikr-progress"><span>الذكر ${toArabicNumber(state.index + 1)} من ${toArabicNumber(state.items.length)}</span>${countLabel}</div>
      <article class="dhikr-highlight" aria-live="polite">
        <h3>${escapeHtml(item.title)}</h3>
        <p class="dhikr-text">${escapeHtml(item.text)}</p>
      </article>
      <div class="dhikr-actions">
        <button class="explanation-button" id="explanation-button" type="button">شرح الذكر وتخريجه</button>
        <button class="counter-button" id="counter-button" type="button">${item.count > 1 ? `العدد ٠ / ${toArabicNumber(item.count)}` : "التالي"}</button>
      </div>
      <section class="explanation-panel" id="explanation-panel" hidden>
        <h4>المعنى والشرح</h4>
        <p>${escapeHtml(item.explanation)}</p>
        ${item.virtue ? `<h4>الفضل والتنبيه</h4><p>${escapeHtml(item.virtue)}</p>` : ""}
        <h4>المصدر والتخريج</h4><p>${escapeHtml(item.source || "")}</p>
        ${source}
      </section>
      ${audio}
      <p class="dhikr-footnote">بعد إكمال العدد اضغط «التالي» للانتقال إلى الذكر الذي يليه.</p>
    `;

    document.getElementById("explanation-button").addEventListener("click", () => {
      const panel = document.getElementById("explanation-panel");
      panel.hidden = !panel.hidden;
      document.getElementById("explanation-button").classList.toggle("is-open", !panel.hidden);
    });
    document.getElementById("counter-button").addEventListener("click", handleCounter);
    setupAudio(item);
  }

  function handleCounter() {
    const item = state.items[state.index];
    const button = document.getElementById("counter-button");
    if (item.count <= 1 || state.count >= item.count) {
      nextItem();
      return;
    }
    state.count += 1;
    if (state.count >= item.count) {
      button.textContent = state.index === state.items.length - 1 ? "إنهاء الورد" : "التالي";
      button.classList.add("is-complete");
    } else {
      button.textContent = `العدد ${toArabicNumber(state.count)} / ${toArabicNumber(item.count)}`;
    }
  }

  function nextItem() {
    if (state.index < state.items.length - 1) {
      state.index += 1;
      render();
      dialogBody.scrollTop = 0;
    } else {
      stopAudio();
      dialogBody.innerHTML = `
        <div class="completion-mark">✓</div>
        <h3 class="completion-title">أتممت أذكار ${state.section === "morning" ? "الصباح" : "المساء"}</h3>
        <p class="completion-text">تقبّل الله ذكرك، وجعل قلبك عامرًا بذكره.</p>
        <button class="counter-button finish-button" id="finish-button" type="button">إغلاق</button>`;
      document.getElementById("finish-button").addEventListener("click", closeDialog);
    }
  }

  function setupAudio(item) {
    const audioElement = document.getElementById("dhikr-audio");
    if (!audioElement || !item.audio) return;
    state.audio = audioElement;
    state.audioSources = item.audio.type === "playlist" ? item.audio.sources : [item.audio.src];
    audioElement.src = state.audioSources[0];
    audioElement.addEventListener("ended", () => {
      state.audioIndex += 1;
      if (state.audioIndex < state.audioSources.length) {
        audioElement.src = state.audioSources[state.audioIndex];
        audioElement.play().catch(() => {});
      }
    });
  }

  async function startSection(section) {
    if (!state.data) {
      try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error("تعذر تحميل ملف الأذكار");
        state.data = await response.json();
      } catch (error) {
        title.textContent = "تعذر تحميل الأذكار";
        symbol.textContent = "!";
        dialogBody.innerHTML = '<p class="load-error">تأكد من اتصال الإنترنت ثم أعد تحميل الصفحة.</p>';
        openDialog();
        return;
      }
    }
    state.section = section;
    const ids = state.data.sections[section] || [];
    const lookup = new Map(state.data.adhkar.map(item => [item.id, item]));
    state.items = ids.map(id => lookup.get(id)).filter(Boolean);
    state.index = 0;
    render();
    openDialog();
  }

  function updatePeriodSuggestion() {
    const hour = new Date().getHours();
    const period = hour >= 4 && hour < 16 ? "morning" : "evening";
    sectionButtons.forEach(button => {
      const selected = button.dataset.section === period;
      button.classList.toggle("is-current", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  sectionButtons.forEach(button => button.addEventListener("click", () => startSection(button.dataset.section)));
  settingsButton.addEventListener("click", () => {
    title.textContent = "الإعدادات";
    symbol.textContent = "۞";
    dialogBody.innerHTML = '<p class="settings-note">تخصيص الإعدادات سيضاف لاحقًا.</p>';
    openDialog();
  });
  closeButton.addEventListener("click", closeDialog);
  backdrop.addEventListener("click", event => { if (event.target === backdrop) closeDialog(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !backdrop.hidden) closeDialog(); });

  updatePeriodSuggestion();
  window.setInterval(updatePeriodSuggestion, 60000);
})();