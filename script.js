(() => {
  "use strict";

  const sectionButtons = document.querySelectorAll("[data-section]");
  const reviewButton = document.getElementById("review-button");
  const backdrop = document.getElementById("dialog-backdrop");
  const closeButton = document.getElementById("dialog-close");
  const actionButton = document.getElementById("dialog-action");
  const title = document.getElementById("dialog-title");
  const message = document.getElementById("dialog-message");
  const symbol = document.getElementById("dialog-symbol");
  const hint = document.querySelector(".section-hint");

  // Local device time: morning suggestion from 04:00 through 15:59.
  // Evening suggestion covers the remaining hours.
  function getCurrentPeriod() {
    const hour = new Date().getHours();
    return hour >= 4 && hour < 16 ? "morning" : "evening";
  }

  function updatePeriodSuggestion() {
    const period = getCurrentPeriod();
    sectionButtons.forEach((button) => {
      const selected = button.dataset.section === period;
      button.classList.toggle("is-current", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    if (hint) {
      hint.textContent = "اختر وِردك";
    }
  }

  function openDialog(dialogTitle, dialogMessage, dialogSymbol = "۞") {
    title.textContent = dialogTitle;
    message.textContent = dialogMessage;
    symbol.textContent = dialogSymbol;
    backdrop.hidden = false;
    closeButton.focus();
    document.body.style.overflow = "hidden";
  }

  function closeDialog() {
    backdrop.hidden = true;
    document.body.style.overflow = "";
  }

  sectionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const isMorning = button.dataset.section === "morning";
      openDialog(
        isMorning ? "أذكار الصباح" : "أذكار المساء",
        "سيتم عرض الأذكار مرتبة مع عدد مرات التكرار في الخطوة التالية.",
        isMorning ? "☀" : "☾"
      );
    });
  });

  reviewButton.addEventListener("click", () => {
    openDialog(
      "المراجعة",
      "ستجد هنا مراجعة الأذكار التي قرأتها ومتابعة وِردك اليومي.",
      "۞"
    );
  });

  closeButton.addEventListener("click", closeDialog);
  actionButton.addEventListener("click", closeDialog);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.hidden) closeDialog();
  });

  updatePeriodSuggestion();
  // Refresh the suggested period if the page remains open across a time boundary.
  window.setInterval(updatePeriodSuggestion, 60 * 1000);
})();