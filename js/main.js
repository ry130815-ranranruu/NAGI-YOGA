"use strict";

// constは変数への再代入を禁止する宣言。要素や配列の中身の変更はできる。
// Object.freezeは設定オブジェクトの各項目も変更できなくする。
// 動きを調整するときは、まず以下の設定値を編集する。1000ミリ秒 = 1秒。
// 【ヒーロー】待機 → 写真のフェードイン → 曲線文字の登場 → 揺れ → 停止。
const HERO_MOTION = Object.freeze({
  // ページの表示開始から、写真が現れ始めるまでの待ち時間。
  wait: 1000,
  // 写真をふわっと表示する時間。完了後に文字が流れ始める。
  photoFade: 1500,
  // 文字が曲線の外側から本来の位置へ移動する時間。増やすとゆっくり登場する。
  enter: 2500,
  // 登場後、文字が揺れている時間。
  sway: 3500,
  // swayの時間内に往復する回数。増やすと同じ時間で細かく揺れる。
  cycles: 1,
  // PC用SVGの最大揺れ幅（画面上のpx相当）。実際の揺れは徐々に小さくなる。
  desktopAmplitude: 150,
  // スマートフォン用SVGの最大揺れ幅（画面上のpx相当）。
  mobileAmplitude: 48,
});
// 【メニュー】閉じる時間（ミリ秒）。開くときはフォーカス位置が見えるよう即座に表示する。
// 閉じる前の80msの待機や、リンクを消す時間はsetupMenu内で指定する。
const MENU_MOTION = Object.freeze({ close: 300 });
// OSやブラウザーの「動きを減らす」設定を監視するオブジェクト。
// .matchesがtrueならアニメーションを省略し、設定変更にも追従する。
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// 1. ページ先頭（.hero）の曲線文字アニメーションを準備する。
function setupHero() {
  // 操作対象のヒーロー領域。対応するHTMLがなければ処理しない。
  const hero = document.querySelector(".hero");
  if (!hero) return;
  const startedAt = performance.now();
  const photo = hero.querySelector(".hero-photo");
  // 曲線文字ごとの情報を配列にまとめる（PC用・スマートフォン用を含む）。
  // text：文字、svg：親のSVG、path：文字が沿う曲線、finalOffset：HTMLで指定した最終位置。
  const tracks = [...hero.querySelectorAll("textPath")].map((text) => ({
    text,
    svg: text.closest("svg"),
    path: hero.querySelector(text.getAttribute("href")),
    finalOffset: text.getAttribute("startOffset"),
  }));
  let frame = 0;
  let finished = false;

  // 次の描画を止めて文字を最終位置へ戻す。data-hero-stateには現在の状態を記録。
  function finish(state = "complete") {
    cancelAnimationFrame(frame);
    photo?.style.removeProperty("opacity");
    tracks.forEach((track) =>
      track.text.setAttribute("startOffset", track.finalOffset),
    );
    hero.dataset.heroState = state;
    finished = true;
  }

  // 設定変更時も即座に最終位置へ。解除後も自動再生し直さない。
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) finish("static");
  });
  if (reducedMotion.matches) {
    finish("static");
    return;
  }
  hero.dataset.heroState = "preparing";

  // 読み込みを待つヒーロー画像（.hero-photo）。
  // 画像を表示できる準備が整うと完了するPromise（非同期処理の完了を表すもの）。
  const imageReady = photo?.decode
    ? photo.decode().catch(() => {})
    : Promise.resolve();
  // 曲線文字用フォントとページのフォントの準備完了を待つPromise。
  const fontsReady = document.fonts
    ? document.fonts
        .load('400 36px "Zen Old Mincho"')
        .then(() => document.fonts.ready)
        .catch(() => {})
    : Promise.resolve();
  let fontsLoaded = false;
  fontsReady.then(() => {
    fontsLoaded = true;
  });

  // 写真はフォントの通信待ちに巻き込まず、画像の準備ができたら開始する。
  imageReady
    .then(() => {
      if (finished) return;
      tracks.forEach((track) => {
        track.startOffset = track.path.getTotalLength() + 1;
        track.text.setAttribute("startOffset", track.startOffset);
      });
      // 通常は表示開始の1秒後。画像の読み込みが遅い場合は、その完了を待つ。
      const photoStartsAt = Math.max(
        startedAt + HERO_MOTION.wait,
        performance.now(),
      );
      const photoEndsAt = photoStartsAt + HERO_MOTION.photoFade;
      let textStartsAt = null;
      hero.dataset.heroState = "waiting";

      function update(now) {
        if (reducedMotion.matches) {
          finish("static");
          return;
        }
        if (now < photoEndsAt) {
          if (now >= photoStartsAt) {
            hero.dataset.heroState = "fading";
            const progress = (now - photoStartsAt) / HERO_MOTION.photoFade;
            // 始まりと終わりを滑らかにし、写真をゆっくり浮かび上がらせる。
            if (photo)
              photo.style.opacity = progress * progress * (3 - 2 * progress);
          }
          frame = requestAnimationFrame(update);
          return;
        }
        photo?.style.removeProperty("opacity");
        if (textStartsAt === null) {
          hero.dataset.heroState = "waiting-text";
          if (!fontsLoaded) {
            frame = requestAnimationFrame(update);
            return;
          }
          textStartsAt = now;
        }
        const elapsed = now - textStartsAt;
        const enterEnd = HERO_MOTION.enter;
        // 揺れも含めた全体の終了時点。
        const end = enterEnd + HERO_MOTION.sway;
        if (elapsed >= end || reducedMotion.matches) {
          finish(reducedMotion.matches ? "static" : "complete");
          return;
        }
        if (elapsed >= enterEnd) {
          hero.dataset.heroState = "swaying";
          // 揺れの進み具合。開始時は0、終了時は1になる。
          const progress = (elapsed - enterEnd) / HERO_MOTION.sway;
          // 左右への往復に減衰を掛け、終盤ほど揺れを小さくする係数。
          const sway =
            Math.sin(progress * Math.PI * 2 * HERO_MOTION.cycles) *
            Math.cos((progress * Math.PI) / 2) ** 2;
          tracks.forEach((track) => {
            // SVGのクラスに応じて、スマートフォン用かPC用の揺れ幅を選ぶ。
            const amplitude = track.svg.classList.contains("hero-wave-text--sp")
              ? HERO_MOTION.mobileAmplitude
              : HERO_MOTION.desktopAmplitude;
            // 画面上のpxをSVG内部の座標へ換算する倍率。
            const scale = track.svg.viewBox.baseVal.width / hero.clientWidth;
            track.text.setAttribute(
              "startOffset",
              Number(track.finalOffset) + amplitude * scale * sway,
            );
          });
        } else {
          hero.dataset.heroState = "moving";
          // 登場の進み具合（0〜1）。
          const progress = elapsed / HERO_MOTION.enter;
          // 最初は速く、最終位置に近づくほどゆっくりになるよう進み具合を補正する。
          const eased = 1 - (1 - progress) ** 3;
          tracks.forEach((track) => {
            // 開始位置と最終位置から求める、このフレームでの文字の位置。
            const offset =
              track.startOffset +
              (Number(track.finalOffset) - track.startOffset) * eased;
            track.text.setAttribute("startOffset", offset);
          });
        }
        frame = requestAnimationFrame(update);
      }
      frame = requestAnimationFrame(update);
    })
    .catch(() => finish("static"));
}

// 2. ヘッダーの開閉メニューを準備する。画面幅1200px以上では通常のナビを表示。
function setupMenu() {
  // ヘッダー全体。以下の要素はこの領域から探す。
  const header = document.querySelector(".site-header");
  // メニューを開閉するボタン。
  const button = header?.querySelector(".toggle-btn");
  // リンクをまとめた開閉パネル。
  const panel = header?.querySelector(".header-nav");
  // パネルの外側をクリックして閉じるための背景。
  const overlay = header?.querySelector(".menu-overlay");
  if (!button || !panel || !overlay) return;
  // 幅1199px以下なら.matchesがtrue。CSS側の切り替え幅と合わせて変更する。
  const compact = window.matchMedia("(max-width: 1199px)");
  // パネル内の全リンク。先頭へのフォーカス移動と、閉じるときの表示制御に使う。
  const links = [...panel.querySelectorAll("a")];
  let open = false;
  let version = 0;
  let animations = [];

  function cancelAnimations() {
    animations.forEach((animation) => animation.cancel());
    animations = [];
  }
  // 実行中の動きを記録し、連打や設定変更時にまとめて中止できるようにする。
  function animate(element, frames, options) {
    // ブラウザーが返すアニメーションの操作用オブジェクト。
    const animation = element.animate(frames, { fill: "both", ...options });
    animations.push(animation);
    return animation.finished.catch(() => {});
  }
  // 開閉状態はaria-expandedで伝える。ラベルは「メニュー」に固定する。
  function label() {
    button.setAttribute("aria-expanded", String(open));
  }

  // returnFocus：閉じた後にボタンへ操作位置を戻す。immediate：動かさず即座に閉じる。
  async function closeMenu({ returnFocus = false, immediate = false } = {}) {
    if (!open && !immediate) return;
    // 今回の操作番号。待機中に別の開閉があれば、古い処理の終了操作を無効にする。
    const token = ++version;
    // 途中で閉じても自然につながるよう、現在表示されているCSSの値を取得する。
    const style = getComputedStyle(panel);
    // 現在の拡大・縮小などの変形状態。
    const transform = style.transform;
    // 現在の不透明度（0：透明、1：不透明）。
    const opacity = style.opacity;
    open = false;
    label();
    if (returnFocus && compact.matches) button.focus({ preventScroll: true });
    panel.inert = compact.matches;
    overlay.hidden = true;
    cancelAnimations();
    if (immediate || reducedMotion.matches || !compact.matches) {
      panel.hidden = compact.matches;
      return;
    }
    links.forEach((link) =>
      animate(link, [{ opacity: 1 }, { opacity: 0 }], { duration: 100 }),
    );
    await animate(
      panel,
      [
        { transform: transform === "none" ? "scale(1)" : transform, opacity },
        { transform: "scale(0.1, 0.08)", opacity: 0 },
      ],
      {
        duration: MENU_MOTION.close,
        delay: 80,
        easing: "cubic-bezier(0.4,0,0.8,1)",
      },
    );
    if (token !== version) return;
    panel.hidden = true;
    cancelAnimations();
  }

  function openMenu() {
    if (!compact.matches) return;
    // 閉じる途中の処理を無効にし、残っている透明・縮小のアニメーションを解除する。
    ++version;
    cancelAnimations();
    open = true;
    label();
    panel.hidden = false;
    panel.inert = false;
    overlay.hidden = false;
    // 全リンクを即座に表示してからフォーカスを移す。素早いTab操作でも現在位置が見える。
    // 遅延したフォーカス移動は行わず、その後のユーザー操作を妨げない。
    links[0]?.focus({ preventScroll: true });
  }

  // ボタン・背景・Escapeキー・リンク選択に開閉処理を割り当てる。
  button.addEventListener("click", () =>
    open ? closeMenu({ returnFocus: true }) : openMenu(),
  );
  overlay.addEventListener("click", () => closeMenu({ returnFocus: true }));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu({ returnFocus: true });
    }
  });
  // 非モーダルのためTabを閉じ込めず、外へ移動したら閉じる。
  document.addEventListener("focusin", (event) => {
    if (open && !panel.contains(event.target) && event.target !== button)
      closeMenu();
  });
  panel.addEventListener("click", (event) => {
    if (event.target.closest("a") && compact.matches)
      closeMenu({ returnFocus: true });
  });
  // 画面幅が切り替わった際、表示状態とキーボードの操作位置を整える。
  function syncWidth() {
    // 現在キーボード操作の対象になっている要素。
    const active = document.activeElement;
    // 狭い画面に切り替わり、隠れるパネル内に操作位置があるか。
    const moveToButton = compact.matches && panel.contains(active);
    // 広い画面に切り替わり、隠れる開閉ボタンに操作位置があるか。
    const moveToLink = !compact.matches && active === button;
    button.hidden = !compact.matches;
    closeMenu({ immediate: true });
    panel.inert = compact.matches;
    if (moveToButton) button.focus({ preventScroll: true });
    if (moveToLink) links[0]?.focus({ preventScroll: true });
  }
  compact.addEventListener("change", syncWidth);
  reducedMotion.addEventListener("change", () => {
    if (!reducedMotion.matches) return;
    cancelAnimations();
    if (!open && compact.matches) panel.hidden = true;
  });
  header.classList.add("menu-ready");
  syncWidth();
}

// 3. 本文の画像・文章・カードを、画面上から55%の位置で一度だけ表示する。
function setupScrollReveal() {
  if (reducedMotion.matches || !("IntersectionObserver" in window)) return;
  const targets = [...document.querySelectorAll("[data-reveal]")];
  if (!targets.length) return;
  let observer;

  function reveal(target) {
    target.classList.add("is-revealed");
    observer?.unobserve(target);
  }

  // 待機中は位置を動かさないため、同じ行のカードは同じタイミングで検知される。
  function observe() {
    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) reveal(entry.target);
        });
      },
      {
        // rootMarginの%は横幅基準なので、高さの45%をpxへ換算する。
        rootMargin: `0px 0px -${window.innerHeight * 0.45}px 0px`,
        threshold: 0,
      },
    );
    targets.forEach((target) => {
      if (!target.classList.contains("is-revealed")) observer.observe(target);
    });
  }

  targets.forEach((target) => target.classList.add("reveal-ready"));
  observe();
  window.addEventListener("resize", observe);
  // Tabキーで未表示のカードへ移動した場合も、操作対象をすぐに表示する。
  document.addEventListener("focusin", (event) => {
    const target = event.target.closest("[data-reveal]");
    if (target) reveal(target);
  });
  reducedMotion.addEventListener("change", () => {
    if (!reducedMotion.matches) return;
    targets.forEach(reveal);
    observer.disconnect();
    window.removeEventListener("resize", observe);
  });
}

// 上で定義した準備処理を実行する。
setupHero();
setupMenu();
setupScrollReveal();
