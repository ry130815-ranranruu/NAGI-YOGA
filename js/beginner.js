"use strict";

// このページだけのQ&A。共通メニューはmain.jsに任せる。
function setupBeginnerFaq() {
  const list = document.querySelector(".beginner-faq-list");
  if (!list || list.classList.contains("beginner-faq-ready")) return;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const items = [...list.querySelectorAll(".beginner-faq-item")].map((element) => ({
    element,
    heading: element.querySelector("h3"),
    question: element.querySelector(".beginner-faq-question"),
    answer: element.querySelector(".beginner-faq-answer"),
  }));
  if (items.some((item) => !item.heading || !item.question || !item.answer)) return;
  let current = null;
  let cancelScrollWait = () => {};

  function setOpen(item, open) {
    item.button.setAttribute("aria-expanded", String(open));
    item.answer.setAttribute("aria-hidden", String(!open));
    item.answer.inert = !open;
  }

  // 開く回答と、同時に閉じる回答の高さ変化が終わってから位置を測る。
  function waitForAnswers(item) {
    const pending = new Set(items.filter(({ answer }) =>
      answer.getAnimations().some((animation) =>
        animation.transitionProperty === "grid-template-rows"
      )
    ).map(({ answer }) => answer));
    if (motion.matches || !pending.size) {
      keepQuestionVisible(item);
      return;
    }
    function cleanup() {
      list.removeEventListener("transitionend", finished);
      list.removeEventListener("transitioncancel", finished);
      cancelScrollWait = () => {};
    }
    function finished(event) {
      if (event.propertyName !== "grid-template-rows") return;
      // 連打で中断された古い遷移のイベントは、新しい遷移の完了扱いにしない。
      if (event.target.getAnimations().some((animation) =>
        animation.transitionProperty === "grid-template-rows" &&
        animation.playState !== "finished"
      )) return;
      pending.delete(event.target);
      if (pending.size) return;
      cleanup();
      if (current === item) keepQuestionVisible(item);
    }
    list.addEventListener("transitionend", finished);
    list.addEventListener("transitioncancel", finished);
    cancelScrollWait = cleanup;
  }

  // 高さの変化が終わってから位置を測る。回答が画面下に収まるときは動かさない。
  function keepQuestionVisible(item) {
    const question = item.button.getBoundingClientRect();
    const bottom = item.element.getBoundingClientRect().bottom;
    if (bottom <= window.innerHeight - 16 && question.top >= 80) return;
    window.scrollTo({
      top: Math.max(0, window.scrollY + question.top - 80),
      behavior: motion.matches ? "instant" : "smooth",
    });
  }

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = item.question.className;
    button.id = item.question.id;
    button.setAttribute("aria-controls", item.answer.id);
    button.append(...item.question.childNodes);
    item.heading.replaceChildren(button);
    item.heading.classList.remove("beginner-faq-question");
    item.heading.removeAttribute("id");
    item.button = button;
    setOpen(item, false);
    item.button.addEventListener("click", () => {
      cancelScrollWait();
      const opening = current !== item;
      if (current) setOpen(current, false);
      current = opening ? item : null;
      if (!opening) return;
      setOpen(item, true);
      waitForAnswers(item);
    });
  });
  list.classList.add("beginner-faq-ready");
  // 初期の閉じた高さを確定させ、読み込み時の閉じるアニメーションを防ぐ。
  list.getBoundingClientRect();
  list.classList.add("beginner-faq-animated");

  // 待機中に設定を変更した場合も、スクロールを動かさず現在位置を整える。
  motion.addEventListener("change", () => {
    cancelScrollWait();
    if (motion.matches) {
      window.scrollTo({ top: window.scrollY, behavior: "instant" });
      if (current) keepQuestionVisible(current);
    }
  });
}

setupBeginnerFaq();
