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
  const state = { data: null, section: null, items: [], index: 0, count: 0, audioIndex: 0, audioSources: [], audio: null, explanationOpen: false, continueListening: true };

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
    state.count = item.count > 1 ? 1 : 0;
    title.textContent = state.section === "morning" ? "أذكار الصباح" : "أذكار المساء";
    symbol.className = "dialog-symbol";
    symbol.textContent = state.section === "morning" ? "☀" : "☾";
    const countLabel = item.count > 1
      ? `<span class="dhikr-count-label">${toArabicNumber(item.count)}</span>`
      : "";
    const hasAudio = Boolean(item.audio?.sources?.length || item.audio?.src);
    dialogBody.innerHTML = `
      <div class="dhikr-progress"><span>الذكر ${toArabicNumber(state.index + 1)} من ${toArabicNumber(state.items.length)}</span>${countLabel}</div>
      <article class="dhikr-highlight" aria-live="polite">
        ${item.kind === "quran" ? `<h3>${escapeHtml(item.title)}</h3>` : ""}
        <p class="dhikr-text">${escapeHtml(String(item.text).trim().replace(/[.。．]+\s*$/, ""))}</p>
      </article>
      <div class="dhikr-actions">
        <button class="explanation-button" id="explanation-button" type="button">الشرح</button>
        ${hasAudio ? '<button class="audio-toggle-button" id="audio-toggle-button" type="button" aria-label="تشغيل الصوت" title="تشغيل الصوت"><svg class="speaker-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M16 9a5 5 0 0 1 0 6M18.5 6.5a8.5 8.5 0 0 1 0 11"/></svg><span class="audio-bars" aria-hidden="true"><i></i><i></i><i></i></span></button>' : ""}
        <button class="counter-button" id="counter-button" type="button">${item.count > 1 ? toArabicNumber(state.count) : "التالي"}</button>
        ${hasAudio ? '<audio id="dhikr-audio" preload="none" hidden></audio>' : ""}
      </div>
      <section class="explanation-panel" id="explanation-panel" ${state.explanationOpen ? "" : "hidden"}>
        <h4>المعنى والشرح</h4>
        <p>${escapeHtml(item.explanation)}</p>
        ${item.source ? `<h4>التخريج</h4><p>${escapeHtml(item.source)}</p>` : ""}
        ${item.virtue ? `<h4>الفضل</h4><p>${escapeHtml(item.virtue)}</p>` : ""}
        ${item.hadithGrade ? `<h4>درجة الحديث</h4><p>${escapeHtml(item.hadithGrade)}</p>` : ""}
      </section>
    `;

    document.getElementById("explanation-button").addEventListener("click", () => {
      const panel = document.getElementById("explanation-panel");
      state.explanationOpen = panel.hidden;
      panel.hidden = !state.explanationOpen;
      document.getElementById("explanation-button").classList.toggle("is-open", state.explanationOpen);
    });
    document.getElementById("counter-button").addEventListener("click", handleCounter);
    setupAudio(item);
  }

  function updateCounterButton() {
    const item = state.items[state.index];
    const button = document.getElementById("counter-button");
    if (!button || !item || item.count <= 1) return;
    button.textContent = toArabicNumber(state.count);
    button.classList.remove("is-complete");
    button.style.setProperty("--fill", (Math.max(0, state.count / item.count) * 100) + "%");
  }

  function handleCounter() {
    const item = state.items[state.index];
    if (item.count <= 1 || state.count >= item.count) {
      nextItem();
      return;
    }
    state.count += 1;
    updateCounterButton();
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
    const toggleButton = document.getElementById("audio-toggle-button");
    if (!audioElement || !toggleButton || !item.audio) return;
    state.audio = audioElement;
    state.audioSources = item.audio.type === "playlist" ? item.audio.sources : [item.audio.src];
    audioElement.src = state.audioSources[0];
    toggleButton.addEventListener("click", async () => {
      if (audioElement.paused) {
        try {
          await audioElement.play();
          toggleButton.classList.add("is-playing");
          toggleButton.setAttribute("aria-label", "إيقاف مؤقت");
          toggleButton.title = "إيقاف مؤقت";
        } catch (_) {
          toggleButton.classList.remove("is-playing");
          toggleButton.setAttribute("aria-label", "تعذر تشغيل الصوت");
        }
      } else {
        audioElement.pause();
        toggleButton.classList.remove("is-playing");
        toggleButton.setAttribute("aria-label", "تشغيل الصوت");
        toggleButton.title = "تشغيل الصوت";
      }
    });
    audioElement.addEventListener("pause", () => {
      toggleButton.classList.remove("is-playing");
      toggleButton.setAttribute("aria-label", "تشغيل الصوت");
      toggleButton.title = "تشغيل الصوت";
    });
    audioElement.addEventListener("ended", async () => {
      state.audioIndex += 1;
      if (state.audioIndex < state.audioSources.length) {
        audioElement.src = state.audioSources[state.audioIndex];
      } else {
        const finishCurrentDhikr = () => {
          if (state.continueListening) nextItem();
          else {
            toggleButton.classList.remove("is-playing");
            toggleButton.setAttribute("aria-label", "تشغيل الصوت");
            toggleButton.title = "تشغيل الصوت";
          }
        };
        if (item.count > 1 && state.count >= item.count) {
          finishCurrentDhikr();
          return;
        }
        state.count += 1;
        updateCounterButton();
        if (item.count <= 1 || state.count >= item.count) {
          finishCurrentDhikr();
          return;
        }
        state.audioIndex = 0;
        audioElement.src = state.audioSources[0];
      }
      try {
        await audioElement.play();
        toggleButton.classList.add("is-playing");
        toggleButton.setAttribute("aria-label", "إيقاف مؤقت");
        toggleButton.title = "إيقاف مؤقت";
      } catch (_) {
        toggleButton.classList.remove("is-playing");
        toggleButton.setAttribute("aria-label", "تشغيل الصوت");
      }
    });;;
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
    state.explanationOpen = false;
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
    symbol.className = "dialog-symbol settings-dialog-symbol";
    symbol.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>';
    dialogBody.innerHTML = `
      <section class="settings-card">
        <div class="settings-copy">
          <strong>مواصلة الاستماع</strong>
          <span>عند التفعيل ينتقل الصوت تلقائيًا إلى الذكر التالي بعد إكمال التكرارات.</span>
        </div>
        <label class="settings-switch" for="continue-listening">
          <input id="continue-listening" type="checkbox" ${state.continueListening ? "checked" : ""}>
          <span class="settings-checkmark" aria-hidden="true"></span>
        </label>
      </section>
`;
    document.getElementById("continue-listening").addEventListener("change", event => {
      state.continueListening = event.target.checked;
    });
    openDialog();
  });
  closeButton.addEventListener("click", closeDialog);
  backdrop.addEventListener("click", event => { if (event.target === backdrop) closeDialog(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !backdrop.hidden) closeDialog(); });

  updatePeriodSuggestion();
  window.setInterval(updatePeriodSuggestion, 60000);
})();