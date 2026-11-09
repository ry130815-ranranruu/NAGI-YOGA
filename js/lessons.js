"use strict";

// デモ専用。入力値の外部送信・保存は行わない。
(() => {
  const form = document.querySelector("#lesson-form");
  if (!form) return;
  const dateInput = form.querySelector("#lesson-date");
  const choices = [...form.querySelectorAll('[name="lesson-type"]')];
  const submit = form.querySelector("#lesson-submit");
  const policyButton = form.querySelector("#lesson-policy-open");
  const japanDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  });
  function japanToday(now = new Date()) {
    const parts = Object.fromEntries(japanDate.formatToParts(now).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function updateMinimum() {
    // 端末のタイムゾーンや夏時間に依存しない日付計算。
    const tomorrow = new Date(`${japanToday()}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    dateInput.min = tomorrow.toISOString().slice(0, 10);
  }
  function showError(id, message, elements = [form.querySelector(`#${id}`)]) {
    document.querySelector(`#${id}-error`).textContent = message;
    elements.forEach(element => {
      if (message) element.setAttribute("aria-invalid", "true");
      else element.removeAttribute("aria-invalid");
    });
    return !message;
  }
  function validateDate() {
    updateMinimum();
    const value = dateInput.value;
    const selected = choices.find(input => input.checked)?.value;
    let message = "";
    if (!value) message = "希望日を選択してください。";
    else if (value < dateInput.min) message = "希望日は翌日以降を選択してください（日本時間）。";
    else if (selected) {
      const weekday = new Date(`${value}T00:00:00Z`).getUTCDay();
      if (weekday !== (selected === "flow" ? 0 : 6)) message = selected === "flow" ? "フローヨガは日曜日を選択してください。" : "エアリアルヨガは土曜日を選択してください。";
    }
    return showError("lesson-date", message);
  }
  function validateText(id, emptyMessage) {
    const input = form.querySelector(`#${id}`);
    let message = input.value.trim() ? "" : emptyMessage;
    if (!message && id === "guest-email" && input.validity.typeMismatch) message = "メールアドレスを正しい形式で入力してください。";
    return showError(id, message);
  }
  function validateChoice() {
    return showError("lesson-type", choices.some(input => input.checked) ? "" : "レッスンの種類を選択してください。", choices);
  }
  function validateConsent() {
    return showError("lesson-consent", form.querySelector("#lesson-consent").checked ? "" : "プライバシーポリシーへの同意が必要です。");
  }
  const checks = {
    "guest-name": () => validateText("guest-name", "お名前を入力してください。"),
    "guest-email": () => validateText("guest-email", "メールアドレスを入力してください。"),
    "guest-phone": () => validateText("guest-phone", "電話番号を入力してください。"),
    "lesson-type": validateChoice,
    "lesson-date": validateDate,
    "lesson-consent": validateConsent,
  };
  form.addEventListener("input", event => {
    const key = event.target.name === "lesson-type" ? "lesson-type" : event.target.id;
    if (event.target.getAttribute("aria-invalid") === "true") checks[key]?.();
  });
  choices.forEach(input => input.addEventListener("change", () => {
    validateChoice();
    if (dateInput.value) validateDate();
  }));
  dateInput.addEventListener("change", validateDate);
  dateInput.addEventListener("focus", updateMinimum);
  window.addEventListener("focus", updateMinimum);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) updateMinimum(); });

  // showModalにより背景を操作対象から外す。Escはdialog標準の閉鎖動作を使う。
  function setupDialog(dialog) {
    let opener;
    dialog.querySelector("[data-dialog-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => opener?.focus());
    dialog.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll('button, a[href], input, [tabindex="0"]')].filter(el => !el.disabled);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    });
    return trigger => {
      opener = trigger;
      dialog.showModal();
      dialog.querySelector("h2").focus();
      dialog.scrollTop = 0;
    };
  }
  const openPolicy = setupDialog(document.querySelector("#lesson-policy-dialog"));
  const openComplete = setupDialog(document.querySelector("#lesson-complete-dialog"));
  policyButton.addEventListener("click", () => openPolicy(policyButton));
  form.addEventListener("submit", event => {
    event.preventDefault();
    const valid = Object.values(checks).map(check => check()).every(Boolean);
    if (!valid) { form.querySelector('[aria-invalid="true"]')?.focus(); return; }
    openComplete(submit);
  });
  updateMinimum();
  policyButton.disabled = false;
  submit.disabled = false;
})();
