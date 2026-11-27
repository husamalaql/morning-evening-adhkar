(() => {
  "use strict";

  const DATA_URL = "data/adhkar.json";
  const isAndroidApp = Boolean(window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.() === "android");
  const sectionButtons = document.querySelectorAll("[data-section]");
  const settingsButton = document.getElementById("settings-button");
  const backdrop = document.getElementById("dialog-backdrop");
  const closeButton = document.getElementById("dialog-close");
  const listButton = document.getElementById("dhikr-list-button");
  const title = document.getElementById("dialog-title");
  const symbol = document.getElementById("dialog-symbol");
  const dialogBody = document.getElementById("dialog-body");
  const state = { data: null, section: null, items: [], index: 0, count: 0, audioIndex: 0, audioSources: [], audioSourcesReady: false, audio: null, explanationOpen: false, continueListening: true, notificationsEnabled: localStorage.getItem('adhkar-notifications-enabled') === 'true', morningTime: localStorage.getItem('adhkar-morning-time') || '07:00', eveningTime: localStorage.getItem('adhkar-evening-time') || '17:00' };

  const toArabicNumber = (value) => String(value).replace(/\d/g, digit => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
  const formatRepeatCount = (value) => value === 2 ? "مرتان" : value === 1 ? "مرة" : `${toArabicNumber(value)} مرات`;
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
    state.audioSourcesReady = false;
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
    listButton.hidden = false;
    listButton.setAttribute("aria-label", "عرض قائمة الأذكار");
    listButton.title = "عرض قائمة الأذكار";
    stopAudio();
    state.count = item.count > 1 ? 1 : 0;
    title.textContent = state.section === "morning" ? "أذكار الصباح" : "أذكار المساء";
    symbol.className = "dialog-symbol";
    symbol.textContent = state.section === "morning" ? "☀" : "☾";
    const countLabel = item.count > 1
      ? `<span class="dhikr-count-label">${formatRepeatCount(item.count)}</span>`
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
        <button class="audio-toggle-button${hasAudio ? "" : " is-unavailable"}" id="audio-toggle-button" type="button" aria-label="${hasAudio ? "تشغيل الصوت" : "لا يتوفر تسجيل صوتي لهذا الذكر"}" title="${hasAudio ? "تشغيل الصوت" : "لا يتوفر تسجيل صوتي لهذا الذكر"}" ${hasAudio ? "" : "disabled"}><svg class="speaker-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M16 9a5 5 0 0 1 0 6M18.5 6.5a8.5 8.5 0 0 1 0 11"/></svg><span class="audio-bars" aria-hidden="true"><i></i><i></i><i></i></span></button>
        <button class="counter-button" id="counter-button" type="button">${item.count > 1 ? toArabicNumber(state.count) : "التالي"}</button>
        ${hasAudio ? '<audio id="dhikr-audio" preload="none" hidden></audio>' : ""}
      </div>
      <section class="explanation-panel" id="explanation-panel" ${state.explanationOpen ? "" : "hidden"}>
        <h4>المعنى والشرح</h4>
        <button class="explanation-scroll-arrow explanation-scroll-up" id="explanation-scroll-up" type="button" aria-label="التمرير إلى الأعلى" hidden>⌃</button>
        <div class="explanation-scroll" id="explanation-scroll" tabindex="0">
          <div class="explanation-content">
            <p>${escapeHtml(item.explanation)}</p>
            ${item.source ? `<h4>التخريج</h4><p>${escapeHtml(item.source)}</p>` : ""}
            ${item.virtue ? `<h4>الفضل</h4><p>${escapeHtml(item.virtue)}</p>` : ""}
            ${item.hadithGrade ? `<h4>درجة الحديث</h4><p>${escapeHtml(item.hadithGrade)}</p>` : ""}
          </div>
        </div>
        <button class="explanation-scroll-arrow explanation-scroll-down" id="explanation-scroll-down" type="button" aria-label="التمرير إلى الأسفل" hidden>⌄</button>
      </section>
    `;

    document.getElementById("explanation-button").addEventListener("click", () => {
      const panel = document.getElementById("explanation-panel");
      state.explanationOpen = panel.hidden;
      panel.hidden = !state.explanationOpen;
      document.getElementById("explanation-button").classList.toggle("is-open", state.explanationOpen);
      if (state.explanationOpen) setupExplanationScroll();
    });
    document.getElementById("counter-button").addEventListener("click", handleCounter);
    setupAudio(item);
  }

  function setupExplanationScroll() {
    const scroller = document.getElementById("explanation-scroll");
    const upButton = document.getElementById("explanation-scroll-up");
    const downButton = document.getElementById("explanation-scroll-down");
    if (!scroller || !upButton || !downButton) return;
    const updateArrows = () => {
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      const canScroll = maxScroll > 2;
      upButton.hidden = !canScroll || scroller.scrollTop <= 2;
      downButton.hidden = !canScroll || scroller.scrollTop >= maxScroll - 2;
    };
    scroller.addEventListener("scroll", updateArrows, { passive: true });
    upButton.addEventListener("click", () => scroller.scrollBy({ top: -Math.max(90, scroller.clientHeight * .72), behavior: "smooth" }));
    downButton.addEventListener("click", () => scroller.scrollBy({ top: Math.max(90, scroller.clientHeight * .72), behavior: "smooth" }));
    requestAnimationFrame(updateArrows);
  }

  function renderDhikrList() {
    stopAudio();
    listButton.hidden = false;
    listButton.setAttribute("aria-label", "العودة إلى الذكر");
    listButton.title = "العودة إلى الذكر";
    dialogBody.innerHTML = `
      <div class="dhikr-list" aria-label="قائمة الأذكار">
        ${state.items.map((item, index) => {
          const fullText = String(item.text || "").trim();
          const summary = item.kind === "quran"
            ? item.title
            : fullText.length <= 105
              ? fullText
              : fullText.slice(0, 105).trimEnd() + "…";
          return `
            <button class="dhikr-list-item ${index === state.index ? "is-current" : ""}" type="button" data-dhikr-index="${index}">
              <span class="dhikr-list-item-top">
                <strong>${escapeHtml(item.title || (item.kind === "quran" ? "سورة قرآنية" : "ذكر"))}</strong>
                <small>${item.count > 1 ? formatRepeatCount(item.count) : "مرة"}</small>
              </span>
              <span class="dhikr-list-summary">${escapeHtml(summary)}</span>
            </button>`;
        }).join("")}
      </div>
    `;
    dialogBody.querySelectorAll("[data-dhikr-index]").forEach(button => {
      button.addEventListener("click", () => {
        state.index = Number(button.dataset.dhikrIndex);
        state.explanationOpen = false;
        render();
        dialogBody.scrollTop = 0;
      });
    });
  }

  function updateCounterButton() {
    const item = state.items[state.index];
    const button = document.getElementById("counter-button");
    if (!button || !item || item.count <= 1) return;
    button.textContent = toArabicNumber(state.count);
    button.classList.remove("is-complete");
    button.style.setProperty("--fill", (Math.max(0, state.count / item.count) * 100) + "%");
  }

  async function ensureAudioSources() {
    if (state.audioSourcesReady) return true;
    const audioElement = state.audio;
    const toggleButton = document.getElementById("audio-toggle-button");
    try {
      if (typeof window.resolveAdhkarAudioSources === "function") {
        state.audioSources = await window.resolveAdhkarAudioSources(state.audioSources);
      }
      state.audioSourcesReady = true;
      if (audioElement && state.audioSources.length) {
        audioElement.src = state.audioSources[state.audioIndex] || state.audioSources[0];
        audioElement.load();
      }
      return true;
    } catch (error) {
      if (toggleButton) {
        toggleButton.classList.remove("is-playing");
        toggleButton.setAttribute("aria-label", "تعذر تحميل التسجيل");
        toggleButton.title = error?.message || "تعذر تحميل التسجيل الصوتي";
      }
      return false;
    }
  }

  async function restartCurrentAudio() {
    const audioElement = state.audio;
    if (!audioElement || audioElement.paused || !state.audioSources.length) return;
    const toggleButton = document.getElementById("audio-toggle-button");
    if (!(await ensureAudioSources())) return;
    state.audioIndex = 0;
    audioElement.pause();
    audioElement.src = state.audioSources[0];
    audioElement.load();
    try {
      await audioElement.play();
      toggleButton?.classList.add("is-playing");
      toggleButton?.setAttribute("aria-label", "إيقاف مؤقت");
      if (toggleButton) toggleButton.title = "إيقاف مؤقت";
    } catch (_) {
      toggleButton?.classList.remove("is-playing");
      toggleButton?.setAttribute("aria-label", "تشغيل الصوت");
      if (toggleButton) toggleButton.title = "تشغيل الصوت";
    }
  }

  function handleCounter() {
    const item = state.items[state.index];
    if (item.count <= 1 || state.count >= item.count) {
      nextItem();
      return;
    }
    state.count += 1;
    updateCounterButton();
    restartCurrentAudio();
  }

  async function playCurrentAudio() {
    const audioElement = state.audio;
    const toggleButton = document.getElementById("audio-toggle-button");
    if (!audioElement || !toggleButton) return;
    try {
      if (!(await ensureAudioSources())) return;
      state.audioIndex = 0;
      audioElement.src = state.audioSources[0];
      audioElement.load();
      audioElement.currentTime = 0;
      await audioElement.play();
      toggleButton.classList.add("is-playing");
      toggleButton.setAttribute("aria-label", "إيقاف مؤقت");
      toggleButton.title = "إيقاف مؤقت";
    } catch (_) {
      toggleButton.classList.remove("is-playing");
      toggleButton.setAttribute("aria-label", "تشغيل الصوت");
      toggleButton.title = "تشغيل الصوت";
    }
  }

  function nextItem(continueAudio = false) {
    if (state.index < state.items.length - 1) {
      state.index += 1;
      render();
      dialogBody.scrollTop = 0;
      if (continueAudio) playCurrentAudio();
    } else {
      stopAudio();
      const completedDate = new Date().toLocaleDateString("en-CA");
      localStorage.setItem("adhkar-completed-" + state.section, completedDate);
      if (typeof window.markAdhkarCompleted === "function") void window.markAdhkarCompleted(state.section, completedDate);
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
    toggleButton.addEventListener("click", async () => {
      if (audioElement.paused) {
        try {
          if (!(await ensureAudioSources())) return;
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
          if (state.continueListening) nextItem(true);
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
        if (item.count <= 1) {
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

  window.openAdhkarSection = startSection;
  sectionButtons.forEach(button => button.addEventListener("click", () => startSection(button.dataset.section)));
  settingsButton.addEventListener("click", () => {
    title.textContent = "الإعدادات";
    listButton.hidden = true;
    symbol.className = "dialog-symbol settings-dialog-symbol";
    symbol.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>';
    dialogBody.innerHTML = `
      <section class="settings-card">
        <div class="settings-copy"><strong>مواصلة الاستماع</strong><span>يستمر بقراءة الأذكار تلقائياً دون توقف بين الأذكار</span></div>
        <label class="settings-switch" for="continue-listening"><input id="continue-listening" type="checkbox" ${state.continueListening ? "checked" : ""}><span class="settings-checkmark" aria-hidden="true"></span></label>
      </section>
      <section class="settings-card notification-settings-card" ${isAndroidApp ? "" : 'hidden style="display:none!important"'}>
        <div class="notification-settings-header">
          <div class="settings-copy"><strong>الإشعار بوقت الأذكار</strong><span>تذكير يومي يفتح أذكار الصباح أو المساء عند النقر عليه</span></div>
          <label class="settings-switch" for="adhkar-notifications"><input id="adhkar-notifications" type="checkbox" ${state.notificationsEnabled ? "checked" : ""}><span class="settings-checkmark" aria-hidden="true"></span></label>
        </div>
        <div class="notification-times" id="notification-times" ${isAndroidApp && state.notificationsEnabled ? "" : 'hidden style="display:none!important"'}>
          <label>وقت أذكار الصباح<input id="morning-time" type="time" value="${state.morningTime}"></label>
          <label>وقت أذكار المساء<input id="evening-time" type="time" value="${state.eveningTime}"></label>
        </div>
      </section>
      <button class="settings-update-button" id="adhkar-update-button" type="button" ${isAndroidApp ? "" : 'hidden style="display:none!important"'}>التحقق من وجود تحديث</button>
      <button class="settings-share" id="share-app-button" type="button"><span class="share-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.6 6.6-4.2M8.7 13.4l6.6 4.2"/></svg></span><span>مشاركة التطبيق عبر واتساب</span><span class="contact-arrow">←</span></button>
      <button class="settings-contact" id="contact-developer-button" type="button"><span class="contact-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.4L3 20l.9-4.7a8.5 8.5 0 1 1 16.6-3.5Z"/><path d="M8.7 8.1c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4-.1.6l-.5.6c-.2.2-.2.4 0 .6.5.9 1.2 1.5 2.1 1.9.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.5.7c.3.1.4.3.4.5 0 .3-.2 1.1-.7 1.5-.5.5-1.2.7-1.9.6-1-.1-2.2-.7-3.4-1.7-1-.9-1.8-2.1-2.1-3-.3-.9 0-1.7.4-2.2Z"/></svg></span><span>تواصل مع المطور عبر واتساب</span><span class="contact-arrow">←</span></button>
      <p class="app-version" id="app-version">الإصدار ${document.querySelector('meta[name="app-version"]')?.content || "1.0.2"}</p>
    `;
    document.getElementById("share-app-button").addEventListener("click", () => {
      const appUrl = "https://adhkar-almuslim.netlify.app/";
      const message = "تطبيق أذكار الصباح والمساء 🌿\\nأذكار يومية بتصميم مريح وإمكانية الاستماع للصوتيات.\\n" + appUrl;
      const shareUrl = "https://wa.me/?text=" + encodeURIComponent(message);
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    });
    document.getElementById("contact-developer-button").addEventListener("click", () => {
      const contactBackdrop = document.getElementById("contact-confirm-backdrop");
      contactBackdrop.hidden = false;
      document.body.style.overflow = "hidden";
      document.getElementById("contact-cancel").focus();
    });
    document.getElementById("continue-listening").addEventListener("change", event => { state.continueListening = event.target.checked; });
    const notificationToggle = document.getElementById("adhkar-notifications");
    const timesPanel = document.getElementById("notification-times");
    const morningInput = document.getElementById("morning-time");
    const eveningInput = document.getElementById("evening-time");
    async function saveNotificationSettings() {
      state.morningTime = morningInput.value || "07:00"; state.eveningTime = eveningInput.value || "17:00";
      localStorage.setItem("adhkar-morning-time", state.morningTime); localStorage.setItem("adhkar-evening-time", state.eveningTime);
      if (state.notificationsEnabled) await window.configureAdhkarNotifications(true, state.morningTime, state.eveningTime);
    }
    notificationToggle.addEventListener("change", async event => {
      const enabled = event.target.checked;
      if (enabled && typeof window.configureAdhkarNotifications !== "function") { event.target.checked = false; alert("الإشعارات متاحة في تطبيق أندرويد فقط."); return; }
      try {
        await window.configureAdhkarNotifications(enabled, state.morningTime, state.eveningTime);
        state.notificationsEnabled = enabled; localStorage.setItem("adhkar-notifications-enabled", String(enabled)); timesPanel.hidden = !enabled;
      } catch (_) { event.target.checked = false; state.notificationsEnabled = false; localStorage.setItem("adhkar-notifications-enabled", "false"); alert("لم يتم تفعيل الإشعارات. تحقق من السماح للتطبيق بإرسال الإشعارات من إعدادات الهاتف."); }
    });

    const updateButton = document.getElementById("adhkar-update-button");
    async function refreshUpdateButton() {
      if (typeof window.getAdhkarUpdateState !== "function") {
        updateButton.textContent = "التحديث متاح في تطبيق أندرويد فقط";
        updateButton.disabled = true;
        return;
      }
      try {
        const updateState = await window.getAdhkarUpdateState();
        updateButton.dataset.state = updateState.status;
        updateButton.textContent = updateState.status === "pending"
          ? "إعادة تثبيت التحديث الجديد"
          : updateState.status === "current"
            ? "لا يوجد تحديث جديد"
            : "التحقق من وجود تحديث";
      } catch (_) {
        updateButton.textContent = "التحقق من وجود تحديث";
      }
    }
    updateButton.addEventListener("click", async () => {
      if (updateButton.dataset.state === "pending") {
        updateButton.disabled = true;
        updateButton.textContent = "جارٍ تطبيق التحديث...";
        try { await window.applyAdhkarUpdate(); }
        catch (_) {
          updateButton.disabled = false;
          updateButton.textContent = "إعادة تثبيت التحديث الجديد";
        }
        return;
      }
      updateButton.disabled = true;
      updateButton.textContent = "جارٍ التحقق من التحديث...";
      try {
        const result = await window.checkAdhkarUpdate();
        if (result.status === "pending") {
          updateButton.dataset.state = "pending";
          updateButton.textContent = "إعادة تثبيت التحديث الجديد";
        } else if (result.status === "current") {
          updateButton.dataset.state = "current";
          updateButton.textContent = "لا يوجد تحديث جديد";
        } else {
          updateButton.textContent = "التحديث متاح في تطبيق أندرويد فقط";
        }
      } catch (error) {
        updateButton.textContent = "تعذر التحقق، حاول مرة أخرى";
        console.error("Update check failed:", error);
      } finally { updateButton.disabled = false; }
    });
    if (sessionStorage.getItem("adhkar-update-applied") === "1") {
      sessionStorage.removeItem("adhkar-update-applied");
      updateButton.dataset.state = "current";
      updateButton.textContent = "تم تثبيت التحديث الجديد";
    } else {
      void refreshUpdateButton();
    }

    morningInput.addEventListener("change", saveNotificationSettings); eveningInput.addEventListener("change", saveNotificationSettings);
    openDialog();
  });
  const contactBackdrop = document.getElementById("contact-confirm-backdrop");
  const closeContactPrompt = () => {
    contactBackdrop.hidden = true;
    if (backdrop.hidden) document.body.style.overflow = "";
  };
  document.getElementById("contact-cancel").addEventListener("click", closeContactPrompt);
  document.getElementById("contact-confirm-close").addEventListener("click", closeContactPrompt);
  document.getElementById("contact-confirm-backdrop").addEventListener("click", event => {
    if (event.target === contactBackdrop) closeContactPrompt();
  });
  document.getElementById("contact-confirm-continue").addEventListener("click", () => {
    const message = "لدي مراجعة أو ملاحظة بخصوص تطبيق الأذكار";
    const url = "https://wa.me/967777273449?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
    closeContactPrompt();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !contactBackdrop.hidden) closeContactPrompt();
  });
  listButton.addEventListener("click", () => {
    if (listButton.getAttribute("aria-label") === "العودة إلى الذكر") render();
    else renderDhikrList();
  });
    closeButton.addEventListener("click", closeDialog);
  backdrop.addEventListener("click", event => { if (event.target === backdrop) closeDialog(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !backdrop.hidden) closeDialog(); });

  updatePeriodSuggestion();
  window.setInterval(updatePeriodSuggestion, 60000);
})();