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
  const state = { data: null, section: null, items: [], index: 0, count: 0, audioIndex: 0, audioSources: [], audioSourcesReady: false, audio: null, explanationOpen: false, explanationEnabled: localStorage.getItem("adhkar-explanation-enabled") !== "false", continueListening: true, notificationsEnabled: localStorage.getItem('adhkar-notifications-enabled') === 'true' };

  const toArabicNumber = (value) => String(value).replace(/\d/g, digit => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
  const formatRepeatCount = (value) => value === 2 ? "مرتان" : value === 1 ? "مرة" : `${toArabicNumber(value)} مرات`;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));

  function showApkUpdatePrompt(update) {
    if (document.getElementById("apk-update-backdrop")) return;
    const layer = document.createElement("div");
    layer.className = "share-dialog-backdrop";
    layer.id = "apk-update-backdrop";
    layer.innerHTML =
      '<section class="share-dialog apk-update-dialog" role="dialog" aria-modal="true" aria-labelledby="apk-update-title">' +
        '<div class="share-message-fields apk-update-content" id="apk-update-content">' +
          '<h3 id="apk-update-title">يتوفر تحديث جديد للتطبيق</h3>' +
          '<p class="apk-update-version">الإصدار ' + escapeHtml(update.version) + '</p>' +
          '<p>هذا التحديث يتطلب تنزيل ملف التطبيق وتثبيته. سيتم اختيار النسخة المناسبة لجهازك تلقائياً.</p>' +
          '<p class="apk-update-status" id="apk-update-status">هل تريد تنزيل التحديث الآن؟</p>' +
        '</div>' +
        '<div class="share-dialog-actions" id="apk-update-actions">' +
          '<button class="share-action-button" id="apk-update-install" type="button">تحديث الآن</button>' +
          '<button class="share-cancel-button" id="apk-update-later" type="button">لاحقاً</button>' +
        '</div>' +
      '</section>';
    document.body.appendChild(layer);
    const content = document.getElementById("apk-update-content");
    const actions = document.getElementById("apk-update-actions");
    const originalContent = content.innerHTML;
    const installButton = document.getElementById("apk-update-install");
    const status = document.getElementById("apk-update-status");
    window.updateAdhkarApkDownloadProgress = percent => {
      const bar = document.getElementById("apk-download-progress-fill");
      if (bar) bar.style.width = Math.max(0, Math.min(100, percent)) + "%";
    };
    installButton.addEventListener("click", async () => {
      content.innerHTML = '<div class="apk-download-progress" role="progressbar" aria-label="تقدم تنزيل التحديث"><div id="apk-download-progress-fill"></div></div>';
      actions.hidden = true;
      installButton.disabled = true;
      try {
        const result = await window.downloadAndInstallAdhkarApkUpdate();
        if (result.status === "permission-required") {
          content.innerHTML = originalContent;
          document.getElementById("apk-update-status").textContent = "اسمح للتطبيق بتثبيت التطبيقات من هذا المصدر، ثم اضغط متابعة التثبيت.";
          actions.hidden = false;
          installButton.textContent = "متابعة التثبيت";
          installButton.disabled = false;
          return;
        }
        if (result.status === "manual-install-required") {
          content.innerHTML = originalContent;
          document.getElementById("apk-update-status").innerHTML = '<a href="' + escapeHtml(result.url) + '" target="_blank" rel="noopener">فتح صفحة تنزيل ملف APK</a>';
          actions.hidden = false;
          installButton.textContent = "فتح التنزيل";
          installButton.disabled = false;
          return;
        }
        if (result.status === "installer-opened") {
          layer.remove();
          delete window.updateAdhkarApkDownloadProgress;
          return;
        }
      } catch (error) {
        console.error("APK update installation failed:", error);
        content.innerHTML = originalContent;
        document.getElementById("apk-update-status").textContent = "تعذر تنزيل التحديث. تحقق من اتصال الإنترنت ثم أعد المحاولة.";
        actions.hidden = false;
        installButton.textContent = "إعادة المحاولة";
        installButton.disabled = false;
      }
    });
    document.getElementById("apk-update-later").addEventListener("click", () => {
      layer.remove();
      delete window.updateAdhkarApkDownloadProgress;
    });
  }
  window.showAdhkarApkUpdatePrompt = showApkUpdatePrompt;

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
        <button class="audio-toggle-button${hasAudio ? "" : " is-unavailable"}" id="audio-toggle-button" type="button" aria-label="${hasAudio ? "تشغيل الصوت" : "لا يتوفر تسجيل صوتي لهذا الذكر"}" title="${hasAudio ? "تشغيل الصوت" : "لا يتوفر تسجيل صوتي لهذا الذكر"}" ${hasAudio ? "" : "disabled"}><svg class="speaker-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M16 9a5 5 0 0 1 0 6M18.5 6.5a8.5 8.5 0 0 1 0 11"/></svg><span class="audio-bars" aria-hidden="true"><i></i><i></i><i></i></span></button>
        <button class="counter-button" id="counter-button" type="button">${item.count > 1 ? toArabicNumber(state.count) : "التالي"}</button>
        ${hasAudio ? '<audio id="dhikr-audio" preload="none" hidden></audio>' : ""}
      </div>
      <section class="explanation-area" id="explanation-area" ${state.explanationEnabled ? "" : "hidden"}>
        <div class="explanation-scroll" id="explanation-scroll" tabindex="0">
          <div class="explanation-panel">
            <div class="explanation-heading">المعنى والشرح</div>
            <div class="explanation-content" ${state.explanationOpen ? "" : "hidden"}>
              <p>${escapeHtml(item.explanation)}</p>
              ${item.source ? `<h4>التخريج</h4><p>${escapeHtml(item.source)}</p>` : ""}
              ${item.virtue ? `<h4>الفضل</h4><p>${escapeHtml(item.virtue)}</p>` : ""}
              ${item.hadithGrade ? `<h4>درجة الحديث</h4><p>${escapeHtml(item.hadithGrade)}</p>` : ""}
            </div>
          </div>
        </div>
      </section>
    `;

    document.getElementById("counter-button").addEventListener("click", handleCounter);
    setupAudio(item);
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
        state.explanationOpen = state.explanationEnabled;
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
    state.explanationOpen = state.explanationEnabled;
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
          <div class="settings-copy"><strong>الإشعار بوقت الأذكار</strong><span>تذكير يومي: أذكار الصباح 7:00 صباحاً، وأذكار المساء 5:00 عصراً</span></div>
          <label class="settings-switch" for="adhkar-notifications"><input id="adhkar-notifications" type="checkbox" ${state.notificationsEnabled ? "checked" : ""}><span class="settings-checkmark" aria-hidden="true"></span></label>
        </div>
      </section>
      <section class="settings-card explanation-setting-card">
        <div class="settings-copy"><strong>إظهار شرح الأذكار</strong><span>عرض معنى الذكر وشرحه أثناء القراءة</span></div>
        <label class="settings-switch" for="show-adhkar-explanation"><input id="show-adhkar-explanation" type="checkbox" ${state.explanationEnabled ? "checked" : ""}><span class="settings-checkmark" aria-hidden="true"></span></label>
      </section>
      <button class="settings-update-button" id="adhkar-update-button" type="button" ${isAndroidApp ? "" : 'hidden style="display:none!important"'}>التحقق من وجود تحديث</button>
      <button class="settings-share" id="share-app-button" type="button"><span class="share-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.6 6.6-4.2M8.7 13.4l6.6 4.2"/></svg></span><span>مشاركة التطبيق</span><span class="contact-arrow">←</span></button>
      <button class="settings-contact" id="contact-developer-button" type="button"><span class="contact-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.4L3 20l.9-4.7a8.5 8.5 0 1 1 16.6-3.5Z"/><path d="M8.7 8.1c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4-.1.6l-.5.6c-.2.2-.2.4 0 .6.5.9 1.2 1.5 2.1 1.9.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.5.7c.3.1.4.3.4.5 0 .3-.2 1.1-.7 1.5-.5.5-1.2.7-1.9.6-1-.1-2.2-.7-3.4-1.7-1-.9-1.8-2.1-2.1-3-.3-.9 0-1.7.4-2.2Z"/></svg></span><span>للمراجعة تواصل معنا عبر الواتس</span><span class="contact-arrow">←</span></button>
      <p class="app-version" id="app-version">الإصدار ${document.querySelector('meta[name="app-version"]')?.content || "1.0.2"}</p>
    if (isAndroidApp && typeof window.getAdhkarNativeAppInfo === "function") {
      window.getAdhkarNativeAppInfo().then(info => {
        const versionLabel = document.getElementById("app-version");
        if (versionLabel && info?.version) versionLabel.textContent = "الإصدار " + info.version;
      }).catch(error => console.error("Could not read installed APK version:", error));
    }
    `;
    document.getElementById("share-app-button").addEventListener("click", openShareConfirmation);
    document.getElementById("show-adhkar-explanation").addEventListener("change", event => {
      state.explanationEnabled = event.target.checked;
      localStorage.setItem("adhkar-explanation-enabled", String(state.explanationEnabled));
    });
    document.getElementById("contact-developer-button").addEventListener("click", openContactConfirmation);
    document.getElementById("continue-listening").addEventListener("change", event => { state.continueListening = event.target.checked; });
    const notificationToggle = document.getElementById("adhkar-notifications");
    notificationToggle.addEventListener("change", async event => {
      const enabled = event.target.checked;
      if (enabled && typeof window.configureAdhkarNotifications !== "function") { event.target.checked = false; alert("الإشعارات متاحة في تطبيق أندرويد فقط."); return; }
      try {
        await window.configureAdhkarNotifications(enabled);
        state.notificationsEnabled = enabled;
        localStorage.setItem("adhkar-notifications-enabled", String(enabled));
      } catch (_) {
        event.target.checked = false;
        state.notificationsEnabled = false;
        localStorage.setItem("adhkar-notifications-enabled", "false");
        alert("لم يتم تفعيل الإشعارات. تحقق من السماح للتطبيق بإرسال الإشعارات من إعدادات الهاتف.");
      }
    });

    const updateButton = document.getElementById("adhkar-update-button");
    updateButton.addEventListener("click", async () => {
      updateButton.disabled = true;
      updateButton.textContent = "جارٍ البحث عن التحديث...";
      try {
        // Offer a native APK update before applying any web-only OTA bundle.
        // This keeps the displayed bundle version from getting ahead of the installed APK.
        if (typeof window.checkAdhkarApkUpdate === "function") {
          const apkResult = await window.checkAdhkarApkUpdate({ silent: true });
          if (apkResult.status === "available") {
            window.showAdhkarApkUpdatePrompt?.(apkResult);
            updateButton.textContent = "يتوفر تحديث جديد";
            return;
          }
        }

        if (typeof window.checkAdhkarUpdate === "function") {
          const liveResult = await window.checkAdhkarUpdate();
          if (liveResult.status === "pending") {
            updateButton.textContent = "جارٍ تثبيت التحديث...";
            await window.applyAdhkarUpdate();
            return;
          }
        }
        updateButton.textContent = "لا يوجد تحديث جديد";
      } catch (error) {
        console.error("Unified update check failed:", error);
        updateButton.textContent = "تعذر التحقق، حاول مرة أخرى";
      } finally {
        updateButton.disabled = false;
      }
    });

    openDialog();
  });

  function fitDialogTextareas(container) {
    container.querySelectorAll(".share-message-fields textarea").forEach(textarea => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    });
  }

  function openContactConfirmation() {
    const message = "السلام عليكم، لدي مراجعة أو ملاحظة بخصوص تطبيق الأذكار، وأرغب في التواصل معكم.";
    const backdrop = document.createElement("div");
    backdrop.className = "share-dialog-backdrop";
    backdrop.id = "contact-confirm-backdrop";
    backdrop.innerHTML = `
      <section class="share-dialog contact-share-dialog" role="dialog" aria-modal="true" aria-labelledby="contact-dialog-title">
        <div class="share-message-fields">
          <input id="contact-dialog-title" type="text" value="التواصل عبر واتساب" readonly aria-label="عنوان الرسالة">
          <textarea id="contact-dialog-message" rows="3" readonly aria-label="نص الرسالة">هل تريد الانتقال إلى واتساب لإرسال مراجعتك أو ملاحظتك حول التطبيق؟</textarea>
        </div>
        <div class="share-dialog-actions">
          <button class="share-action-button" id="contact-whatsapp-continue" type="button">متابعة إلى واتساب</button>
          <button class="share-cancel-button" id="contact-dialog-cancel" type="button">إلغاء</button>
        </div>
      </section>`;
    document.body.appendChild(backdrop);
    fitDialogTextareas(backdrop);
    let handleEscape;
    const close = () => {
      backdrop.remove();
      document.removeEventListener("keydown", handleEscape);
    };
    backdrop.addEventListener("click", event => { if (event.target === backdrop) close(); });
    backdrop.querySelector("#contact-dialog-cancel").addEventListener("click", close);
    backdrop.querySelector("#contact-whatsapp-continue").addEventListener("click", () => {
      close();
      window.open("https://wa.me/967777273449?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
    });
    handleEscape = event => {
      if (event.key === "Escape" && document.getElementById("contact-confirm-backdrop")) {
        close();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);
    backdrop.querySelector("#contact-whatsapp-continue").focus();
  }

  function openShareConfirmation() {
    const backdrop = document.createElement("div");
    backdrop.className = "share-dialog-backdrop";
    backdrop.id = "share-confirm-backdrop";
    backdrop.innerHTML = `
      <section class="share-dialog share-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="share-confirm-title">
        <div class="share-message-fields">
          <input id="share-confirm-title" type="text" value="مشاركة تطبيق الأذكار" readonly aria-label="عنوان الرسالة">
          <textarea rows="4" readonly aria-label="نص التأكيد">هل تريد مشاركة التطبيق مع أصدقائك؟
فالدال على الخير كفاعله.
سيتم مشاركة ملف نصي فيه رابط موقع الأذكار ورابط تحميل التطبيق</textarea>
        </div>
        <div class="share-dialog-actions">
          <button class="share-action-button" id="share-confirm-yes" type="button">مشاركة التطبيق</button>
          <button class="share-cancel-button" id="share-confirm-no" type="button">إلغاء</button>
        </div>
      </section>`;
    document.body.appendChild(backdrop);
    fitDialogTextareas(backdrop);
    let handleEscape;
    const close = () => {
      backdrop.remove();
      document.removeEventListener("keydown", handleEscape);
    };
    backdrop.addEventListener("click", event => { if (event.target === backdrop) close(); });
    backdrop.querySelector("#share-confirm-no").addEventListener("click", close);
    backdrop.querySelector("#share-confirm-yes").addEventListener("click", () => {
      close();
      void shareApp();
    });
    handleEscape = event => {
      if (event.key === "Escape" && document.getElementById("share-confirm-backdrop")) close();
    };
    document.addEventListener("keydown", handleEscape);
    backdrop.querySelector("#share-confirm-yes").focus();
  }

  async function shareApp() {
    const titleText = "أذكار الصباح والمساء";
    const messageText = [
      "أهلاً! أشاركك تطبيق أذكار الصباح والمساء.",
      "فالدال على الخير كفاعله.",
      "",
      "رابط موقع الأذكار:",
      "https://adhkar-almuslim.netlify.app/",
      "",
      "رابط تحميل التطبيق (APK):",
      "https://github.com/husamalaql/morning-evening-adhkar/actions/workflows/android.yml"
    ].join("\n");
    const fileName = "adhkar-app-links.txt";
    const file = new File(["\uFEFF", messageText], fileName, { type: "text/plain;charset=utf-8" });
    const downloadFile = () => {
      const blobUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    };
    try {
      if (typeof window.shareAdhkarContent === "function") {
        await window.shareAdhkarContent({ title: titleText, text: messageText, fileName, dialogTitle: "مشاركة تطبيق الأذكار" });
        return;
      }
      if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: titleText, files: [file] });
        return;
      }
      if (isAndroidApp) throw new Error("خدمة مشاركة الملفات غير متاحة في التطبيق حالياً.");
      if (typeof navigator.share === "function") {
        await navigator.share({ title: titleText, text: messageText });
        return;
      }
      downloadFile();
    } catch (error) {
      if (error?.name === "AbortError" || error?.message === "Share canceled") return;
      console.error("App file sharing failed:", error);
      if (isAndroidApp) {
        alert("تعذرت مشاركة الملف. تحقق من تحديث التطبيق ثم حاول مرة أخرى.");
      } else {
        downloadFile();
      }
    }
  }
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