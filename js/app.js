/* ==========================================================================
   MDM FURNITURE — app.js
   Interaction, commerce, motion and scene direction.
   ========================================================================== */

(() => {
  "use strict";

  /* ---------- Shortcuts & constants ---------- */
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const smoothQuery = window.matchMedia("(min-width: 992px) and (hover: hover) and (pointer: fine)");

  const CART_KEY = "mdm-furniture-cart-v1";
  const WISH_KEY = "mdm-furniture-wishlist-v1";
  const FREE_DELIVERY = 1500;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const ICON = {
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m5 12.5 4.4 4.4L19 6.9"/></svg>',
    bag:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M6 7.5h12l-1 12.5H7L6 7.5Z"/><path d="M9 7.5V6a3 3 0 0 1 6 0v1.5"/></svg>',
    heart:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 20.2s-7.2-4.6-7.2-9.6A3.9 3.9 0 0 1 12 7.4a3.9 3.9 0 0 1 7.2 3.2c0 5-7.2 9.6-7.2 9.6Z"/></svg>',
    minus:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14"/></svg>',
    plus:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    arrow:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
    lock:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="1.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
    star:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.7 2.9 5.9 6.5.94-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.94L12 2.7Z"/></svg>',
  };

  const body = document.body;
  const html = document.documentElement;
  const nav = $("#nav");
  const content = $("#smoothContent");
  const mobileMenu = $("#mobileMenu");
  const menuToggle = $("#menuToggle");
  const cartDrawer = $("#cartDrawer");
  const drawerBackdrop = $("#drawerBackdrop");
  const modal = $("#productModal");
  const modalMainImage = $("#modalMainImage");
  const modalThumbs = $("#modalThumbs");
  const modalInfo = $("#modalInfo");
  const modalBadge = $("#modalBadge");
  const grid = $("#productGrid");
  const sortSelect = $("#sortSelect");
  const productCount = $("#productCount");
  const shopEmpty = $("#shopEmpty");
  const filterButtons = $$(".filter");
  const toastStack = $("#toastStack");

  const state = {
    filter: "all",
    sort: "featured",
    cart: loadCart(),
    wishlist: new Set(loadJSON(WISH_KEY, [])),
  };

  let modalOpen = false;
  let cartOpen = false;
  let menuOpen = false;
  let currentProduct = null;
  let modalQty = 1;
  let galleryIndex = 0;
  let checkoutState = "idle";
  let orderNumber = "";
  let lastFocus = null;

  /* ---------- Utilities ---------- */
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* Storage can be unavailable in private contexts. */
    }
  }

  function loadCart() {
    const stored = loadJSON(CART_KEY, []);
    if (!Array.isArray(stored)) return [];
    return stored
      .filter(
        (item) =>
          item &&
          PRODUCTS.some((product) => product.id === item.id) &&
          Number.isFinite(item.qty) &&
          item.qty > 0
      )
      .map((item) => ({ id: item.id, qty: Math.min(99, Math.floor(item.qty)) }));
  }

  const productById = (id) => PRODUCTS.find((product) => product.id === id);
  const categoryLabel = (category) => CATEGORY_LABELS[category] || category;
  const pad = (value) => String(value).padStart(2, "0");

  function toast(message) {
    if (!toastStack) return;
    const element = document.createElement("div");
    element.className = "toast";
    element.innerHTML = ICON.check;
    const text = document.createElement("span");
    text.textContent = message;
    element.appendChild(text);
    toastStack.appendChild(element);
    requestAnimationFrame(() => requestAnimationFrame(() => element.classList.add("is-show")));
    window.setTimeout(() => {
      element.classList.remove("is-show");
      window.setTimeout(() => element.remove(), 480);
    }, 3200);
  }

  /* ---------- Preloader ---------- */
  function initPreloader() {
    const preloader = $("#preloader");
    const counter = $("#preloaderCount");
    const bar = $("#preloaderBar");
    if (!preloader) return;

    const minimum = prefersReduced.matches ? 450 : 2200;
    const started = performance.now();
    let finished = false;
    let scheduled = false;

    function tick(now) {
      if (finished) return;
      const progress = Math.min(1, (now - started) / minimum);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (counter) counter.textContent = pad(Math.floor(eased * 100));
      if (bar) bar.style.transform = `scaleX(${eased})`;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    function finish() {
      if (finished) return;
      finished = true;
      if (counter) counter.textContent = "100";
      if (bar) bar.style.transform = "scaleX(1)";
      body.classList.remove("is-loading");
      body.classList.add("ready");
      preloader.classList.add("preloader--done");
      window.setTimeout(() => {
        preloader.style.display = "none";
        measureContent();
        updateReveals(true);
        if (location.hash.length > 1) {
          const target = document.querySelector(location.hash);
          if (target) scrollToSection(location.hash);
        }
      }, 1150);
    }

    function schedule() {
      if (scheduled || finished) return;
      scheduled = true;
      const elapsed = performance.now() - started;
      const wait = Math.max(0, minimum - elapsed);
      window.setTimeout(finish, wait + 60);
    }

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    window.setTimeout(() => {
      scheduled = true;
      finish();
    }, 4500);
  }

  /* ---------- Smooth scroll, parallax, hero ---------- */
  let smoothOn = false;
  let currentScroll = window.scrollY;
  let revealElements = [];
  let counterElements = [];
  let frameTick = 0;

  function measureContent() {
    if (!smoothOn || !content) {
      body.style.height = "";
      return;
    }
    body.style.height = `${content.scrollHeight}px`;
  }

  function applySmoothMode() {
    const shouldSmooth = smoothQuery.matches && !prefersReduced.matches;
    if (shouldSmooth === smoothOn) {
      if (smoothOn) measureContent();
      return;
    }
    smoothOn = shouldSmooth;
    body.classList.toggle("smooth-mode", smoothOn);
    if (smoothOn) {
      currentScroll = window.scrollY;
      if (content) content.style.transform = `translate3d(0, ${-currentScroll}px, 0)`;
      measureContent();
    } else {
      if (content) content.style.transform = "";
      body.style.height = "";
      currentScroll = window.scrollY;
    }
  }

  function updateHero(scroll) {
    const heroImage = $("#heroImg");
    const heroInner = $("#heroInner");
    if (!heroImage || !heroInner) return;
    const limit = window.innerHeight;
    const amount = Math.min(scroll, limit * 1.2);
    heroImage.style.transform = `translate3d(0, ${(amount * 0.32).toFixed(1)}px, 0) scale(1.06)`;
    heroInner.style.transform = `translate3d(0, ${(amount * 0.12).toFixed(1)}px, 0)`;
    heroInner.style.opacity = String(Math.max(0, 1 - amount / (limit * 0.92)));
  }

  function updateParallax() {
    const viewport = window.innerHeight;
    const elements = document.querySelectorAll("[data-parallax]");
    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.bottom < -160 || rect.top > viewport + 160) return;
      const speed = parseFloat(element.dataset.parallax) || 0;
      const scale = parseFloat(element.dataset.scale) || 1;
      const distance = (rect.top + rect.height / 2 - viewport / 2) * -speed;
      element.style.transform = `translate3d(0, ${distance.toFixed(2)}px, 0) scale(${scale})`;
    });
  }

  function updateReveals(force = false) {
    if (!revealElements.length) return;
    const viewport = window.innerHeight;
    revealElements = revealElements.filter((element) => {
      if (!element.isConnected) return false;
      const rect = element.getBoundingClientRect();
      if (force || (rect.top < viewport * 0.92 && rect.bottom > -40)) {
        element.classList.add("is-visible");
        return false;
      }
      return true;
    });
  }

  function animateCount(element) {
    const target = parseInt(element.dataset.count, 10) || 0;
    if (prefersReduced.matches) {
      element.textContent = String(target);
      return;
    }
    const duration = 1500;
    const started = performance.now();
    function step(now) {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
      else element.textContent = String(target);
    }
    requestAnimationFrame(step);
  }

  function updateCounters() {
    if (!counterElements.length) return;
    const viewport = window.innerHeight;
    counterElements = counterElements.filter((element) => {
      if (!element.isConnected) return false;
      const rect = element.getBoundingClientRect();
      if (rect.top < viewport * 0.92 && rect.bottom > 0) {
        animateCount(element);
        return false;
      }
      return true;
    });
  }

  function startRenderLoop() {
    function frame() {
      const target = window.scrollY;
      if (smoothOn) {
        currentScroll += (target - currentScroll) * 0.09;
        if (Math.abs(target - currentScroll) < 0.06) currentScroll = target;
        if (content) content.style.transform = `translate3d(0, ${-currentScroll.toFixed(2)}px, 0)`;
      } else {
        currentScroll = target;
      }

      if (!prefersReduced.matches) {
        updateHero(currentScroll);
        updateParallax();
      }

      frameTick += 1;
      if (frameTick % 3 === 0) {
        updateReveals();
        updateCounters();
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function scrollToSection(target) {
    const element =
      typeof target === "string" && target !== "home" ? document.querySelector(target) : $("#home");
    let destination = 0;
    if (element && target !== "home" && target !== 0) {
      const rect = element.getBoundingClientRect();
      const baseline = smoothOn ? currentScroll : window.scrollY;
      destination = rect.top + baseline - (window.innerWidth <= 980 ? 66 : 76);
    }
    destination = Math.max(0, destination);
    if (smoothOn && !prefersReduced.matches) {
      window.scrollTo(0, destination);
    } else {
      window.scrollTo({ top: destination, behavior: prefersReduced.matches ? "auto" : "smooth" });
    }
  }

  /* ---------- Navigation ---------- */
  function initNav() {
    const links = $$(".nav__link");
    const sections = links
      .map((link) => ({ link, section: document.querySelector(link.getAttribute("href")) }))
      .filter((item) => item.section);

    let lastY = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      nav.classList.toggle("scrolled", y > 40);

      if (!menuOpen && !cartOpen && !modalOpen) {
        if (y > 640 && y > lastY + 8) nav.classList.add("is-hidden");
        else if (y < lastY - 8 || y < 180) nav.classList.remove("is-hidden");
      }
      lastY = y;

      const threshold = window.innerHeight * 0.42;
      let active = sections[0];
      sections.forEach((item) => {
        if (item.section.getBoundingClientRect().top <= threshold) active = item;
      });
      links.forEach((link) => link.classList.toggle("is-active", link === active.link));
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function openMenu() {
    if (menuOpen) return;
    menuOpen = true;
    nav.classList.remove("is-hidden");
    nav.classList.add("menu-open");
    mobileMenu.classList.add("is-open");
    mobileMenu.setAttribute("aria-hidden", "false");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close menu");
    body.classList.add("menu-open");
    window.setTimeout(() => {
      const first = mobileMenu.querySelector(".mobile-menu__link");
      if (first && menuOpen) first.focus({ preventScroll: true });
    }, 450);
  }

  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    nav.classList.remove("menu-open");
    mobileMenu.classList.remove("is-open");
    mobileMenu.setAttribute("aria-hidden", "true");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
    body.classList.remove("menu-open");
  }

  function toggleMenu() {
    if (menuOpen) closeMenu();
    else openMenu();
  }

  /* ---------- Collection ---------- */
  function getVisibleProducts() {
    let list =
      state.filter === "all"
        ? PRODUCTS.slice()
        : PRODUCTS.filter((product) => product.category === state.filter);

    switch (state.sort) {
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "name-asc":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
        list.sort((a, b) => Number(b.tag === "New") - Number(a.tag === "New"));
        break;
      default:
        break;
    }
    return list;
  }

  function productCard(product, index) {
    const saved = state.wishlist.has(product.id);
    const badgeClass =
      product.tag === "New"
        ? " product-badge--new"
        : product.tag === "Bestseller"
        ? " product-badge--best"
        : "";

    return `
      <article class="product-card is-entering" data-id="${product.id}" style="--i:${index}">
        <div class="product-tilt">
          <div class="product-media">
            <img class="product-img product-img--primary" src="${IMG(product.images[0], IMG_WIDTHS.card)}" alt="${product.name}" loading="lazy" decoding="async">
            <img class="product-img product-img--alt" src="${IMG(product.images[1], IMG_WIDTHS.card)}" alt="" aria-hidden="true" loading="lazy" decoding="async">
            ${product.tag ? `<span class="product-badge${badgeClass}">${product.tag}</span>` : ""}
            <button class="wishlist${saved ? " is-saved" : ""}" data-wishlist="${product.id}" aria-label="Save ${product.name} to wishlist" aria-pressed="${saved}">${ICON.heart}</button>
            <div class="product-actions">
              <button class="card-view" data-view="${product.id}">View details</button>
              <button class="card-add" data-add="${product.id}">Add to cart</button>
            </div>
          </div>
          <div class="product-info">
            <p class="product-cat">${categoryLabel(product.category)}</p>
            <div class="product-row">
              <h3 class="product-name"><button data-view="${product.id}">${product.name}</button></h3>
              <p class="product-price">${money.format(product.price)}</p>
            </div>
            <p class="product-desc">${product.desc}</p>
          </div>
        </div>
      </article>`;
  }

  function renderProducts() {
    if (!grid) return;
    const list = getVisibleProducts();
    grid.innerHTML = list.map(productCard).join("");
    if (productCount) productCount.textContent = `${list.length} ${list.length === 1 ? "piece" : "pieces"}`;
    if (shopEmpty) shopEmpty.hidden = list.length > 0;
    bindCardTilt();
  }

  function bindCardTilt() {
    if (!finePointer.matches || prefersReduced.matches) return;
    $$(".product-card", grid).forEach((card) => {
      const tilt = card.querySelector(".product-tilt");
      const media = card.querySelector(".product-media");
      if (!tilt) return;
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const py = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
        const rotateX = (0.5 - py) * 8;
        const rotateY = (px - 0.5) * 10;
        tilt.style.transition = "transform 0.12s linear, box-shadow 0.6s var(--ease)";
        tilt.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
        if (media) {
          media.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
          media.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
        }
      });
      card.addEventListener("pointerleave", () => {
        tilt.style.transition = "transform 0.7s var(--ease), box-shadow 0.6s var(--ease)";
        tilt.style.transform = "";
      });
    });
  }

  function setFilter(filter) {
    state.filter = CATEGORY_LABELS[filter] ? filter : "all";
    filterButtons.forEach((button) => {
      const active = button.dataset.filter === state.filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    renderProducts();
  }

  function applyFilterAndScroll(filter) {
    closeMenu();
    setFilter(filter);
    window.setTimeout(() => scrollToSection("#shop"), 60);
  }

  function initCollection() {
    renderProducts();

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => setFilter(button.dataset.filter));
    });

    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        state.sort = sortSelect.value;
        renderProducts();
      });
    }

    grid.addEventListener("click", (event) => {
      const card = event.target.closest(".product-card");
      if (!card) return;
      if (event.target.closest("button, a")) return;
      openModal(card.dataset.id);
    });
  }

  function toggleWishlist(id) {
    const product = productById(id);
    if (!product) return;
    if (state.wishlist.has(id)) {
      state.wishlist.delete(id);
      toast(`${product.name} removed from your wishlist`);
    } else {
      state.wishlist.add(id);
      toast(`${product.name} saved to your wishlist`);
    }
    saveJSON(WISH_KEY, Array.from(state.wishlist));
    $$(`[data-wishlist="${id}"]`).forEach((button) => {
      const saved = state.wishlist.has(id);
      button.classList.toggle("is-saved", saved);
      button.setAttribute("aria-pressed", String(saved));
    });
  }

  /* ---------- 3D signature stage ---------- */
  function initStage() {
    const stageImage = $("#stageImage");
    const stageName = $("#stageName");
    const stagePrice = $("#stagePrice");
    const stageProduct = $("#stageProduct");
    const stageView = $("#stageViewBtn");
    const thumbs = $$("#stageThumbs .stage__thumb");
    const reflection = $(".stage__reflection img");
    if (!stageImage || !stageProduct) return;

    let index = 0;

    function paint(i) {
      const product = productById(STAGE_PIECES[i]);
      if (!product) return;
      stageImage.src = IMG(product.images[0], 1100);
      stageImage.alt = product.name;
      if (reflection) reflection.src = IMG(product.images[0], 1100);
      if (stageName) stageName.textContent = product.name;
      if (stagePrice) stagePrice.textContent = money.format(product.price);
      if (stageView) stageView.dataset.view = product.id;
      thumbs.forEach((thumb, thumbIndex) => {
        thumb.classList.toggle("is-active", thumbIndex === i);
        thumb.setAttribute("aria-selected", String(thumbIndex === i));
      });
    }

    function select(i) {
      if (i === index) return;
      index = i;
      stageProduct.classList.add("is-swapping");
      window.setTimeout(() => {
        paint(i);
        stageProduct.classList.remove("is-swapping");
      }, 260);
    }

    paint(0);
    thumbs.forEach((thumb, i) => thumb.addEventListener("click", () => select(i)));

    if (finePointer.matches && !prefersReduced.matches) {
      const stage = $("#stage");
      const tilt = $("#stageTilt");
      if (stage && tilt) {
        stage.addEventListener("pointermove", (event) => {
          const rect = stage.getBoundingClientRect();
          const px = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
          const py = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
          const rotateX = 2 + (0.5 - py) * 10;
          const rotateY = -9 + (px - 0.5) * 16;
          tilt.style.transition = "transform 0.12s ease-out";
          tilt.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
        });
        stage.addEventListener("pointerleave", () => {
          tilt.style.transition = "transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)";
          tilt.style.transform = "rotateX(2deg) rotateY(-9deg)";
        });
      }
    }
  }

  /* ---------- Product modal ---------- */
  function openModal(id) {
    const product = productById(id);
    if (!product) return;

    if (cartOpen) closeCart();
    if (menuOpen) closeMenu();

    currentProduct = product;
    modalQty = 1;
    galleryIndex = 0;
    fillModal(product);

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    nav.classList.remove("is-hidden");
    modalOpen = true;
    lastFocus = document.activeElement;
    window.setTimeout(() => {
      const close = $("#modalClose");
      if (close && modalOpen) close.focus({ preventScroll: true });
    }, 120);
  }

  function fillModal(product) {
    modalMainImage.src = IMG(product.images[0], 1400);
    modalMainImage.alt = product.name;
    modalBadge.textContent = product.tag || "";

    modalThumbs.innerHTML = product.images
      .map(
        (image, index) => `
        <button class="modal__thumb${index === 0 ? " is-active" : ""}" data-gallery="${index}" aria-label="View image ${index + 1}">
          <img src="${IMG(image, IMG_WIDTHS.thumb)}" alt="" loading="lazy">
        </button>`
      )
      .join("");

    const relatedPool = PRODUCTS.filter(
      (item) => item.id !== product.id && item.category === product.category
    );
    const fallback = PRODUCTS.filter((item) => item.id !== product.id);
    const related = relatedPool.length >= 3 ? relatedPool.slice(0, 3) : [...relatedPool, ...fallback].slice(0, 3);

    modalInfo.innerHTML = `
      <p class="modal__cat">${categoryLabel(product.category)}</p>
      <h2 class="modal__title" id="modalTitle">${product.name}</h2>
      <div class="modal__rating">
        <span class="modal__stars">${ICON.star.repeat(5)}</span>
        <span>${product.rating.toFixed(1)} · ${product.reviews} reviews</span>
      </div>
      <p class="modal__price">${money.format(product.price)}<small>${product.lead}</small></p>
      <p class="modal__desc">${product.desc}</p>
      <div class="modal__specs">
        <p class="modal__spec"><span>Dimensions</span>${product.dimensions}</p>
        <p class="modal__spec"><span>Materials</span>${product.material}</p>
        <p class="modal__spec"><span>Finish</span>${product.finish}</p>
        <p class="modal__spec"><span>Delivery</span>${product.lead}</p>
      </div>
      <div class="modal__buy">
        <div class="qty" aria-label="Quantity">
          <button data-modal-minus aria-label="Decrease quantity">${ICON.minus}</button>
          <span id="modalQty">1</span>
          <button data-modal-plus aria-label="Increase quantity">${ICON.plus}</button>
        </div>
        <button class="btn btn--dark modal__add" data-modal-add>Add to cart — ${money.format(product.price)}</button>
      </div>
      <div class="modal__perks">
        <span>${ICON.check} Complimentary delivery over $1,500</span>
        <span>${ICON.check} 10-year craft warranty</span>
        <span>${ICON.check} 30-day home trial</span>
      </div>
      <div class="modal__related">
        <p class="modal__related-title">You may also like</p>
        <div class="modal__related-grid">
          ${related
            .map(
              (item) => `
            <button class="modal__related-card" data-related="${item.id}">
              <img src="${IMG(item.images[0], IMG_WIDTHS.thumb)}" alt="${item.name}" loading="lazy">
              <span class="modal__related-name">${item.name}</span>
              <span class="modal__related-price">${money.format(item.price)}</span>
            </button>`
            )
            .join("")}
        </div>
      </div>`;

    if (modalInfo) modalInfo.scrollTop = 0;
  }

  function closeModal() {
    if (!modalOpen) return;
    modalOpen = false;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    body.classList.remove("modal-open");
    if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
  }

  function setGalleryImage(index) {
    if (!currentProduct) return;
    galleryIndex = index;
    modalMainImage.classList.add("is-fading");
    window.setTimeout(() => {
      modalMainImage.src = IMG(currentProduct.images[index], 1400);
      modalMainImage.alt = currentProduct.name;
      modalMainImage.classList.remove("is-fading");
    }, 220);
    $$("#modalThumbs .modal__thumb").forEach((thumb, thumbIndex) => {
      thumb.classList.toggle("is-active", thumbIndex === index);
    });
  }

  function updateModalQty() {
    const quantity = $("#modalQty");
    if (quantity) quantity.textContent = String(modalQty);
    const addButton = $("[data-modal-add]");
    if (addButton && currentProduct) {
      addButton.innerHTML = `Add to cart — ${money.format(currentProduct.price * modalQty)}`;
    }
  }

  /* ---------- Cart ---------- */
  const cartCount = () => state.cart.reduce((sum, item) => sum + item.qty, 0);
  const cartSubtotal = () =>
    state.cart.reduce((sum, item) => {
      const product = productById(item.id);
      return sum + (product ? product.price * item.qty : 0);
    }, 0);

  function updateBadge(bump = false) {
    const count = cartCount();
    const badge = $("#cartCount");
    const drawerCount = $("#cartDrawerCount");
    if (badge) badge.textContent = String(count);
    if (drawerCount) drawerCount.textContent = `(${count})`;
    if (bump && badge) {
      badge.classList.remove("is-bump");
      void badge.offsetWidth;
      badge.classList.add("is-bump");
      window.setTimeout(() => badge.classList.remove("is-bump"), 620);
    }
  }

  function cartItemMarkup(item) {
    const product = productById(item.id);
    if (!product) return "";
    return `
      <div class="cart-item">
        <div class="cart-item__media">
          <img src="${IMG(product.images[0], IMG_WIDTHS.thumb)}" alt="${product.name}" loading="lazy">
        </div>
        <div class="cart-item__body">
          <p class="cart-item__cat">${categoryLabel(product.category)}</p>
          <p class="cart-item__name">${product.name}</p>
          <div class="cart-item__meta">
            <div class="qty">
              <button data-cart-minus="${product.id}" aria-label="Decrease ${product.name} quantity">${ICON.minus}</button>
              <span>${item.qty}</span>
              <button data-cart-plus="${product.id}" aria-label="Increase ${product.name} quantity">${ICON.plus}</button>
            </div>
            <p class="cart-item__price">${money.format(product.price * item.qty)}</p>
          </div>
          <button class="cart-item__remove" data-cart-remove="${product.id}">Remove</button>
        </div>
      </div>`;
  }

  function renderCart(animate = false) {
    const inner = $("#cartInner");
    if (!inner) return;

    if (checkoutState === "processing") {
      inner.innerHTML = `<div class="cart-loading"><span class="spinner"></span>Preparing your order</div>`;
      return;
    }

    if (checkoutState === "success") {
      inner.innerHTML = `
        <div class="cart-success">
          <div class="cart-success__check">${ICON.check}</div>
          <h4>Order confirmed</h4>
          <p>Thank you. Our concierge team will be in touch to arrange your white-glove delivery.</p>
          <p class="cart-success__order">Order ${orderNumber}</p>
          <button class="btn btn--dark" data-cart-continue>Continue shopping ${ICON.arrow}</button>
        </div>`;
      return;
    }

    if (!state.cart.length) {
      inner.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty__icon">${ICON.bag}</div>
          <h4>Your cart is quiet</h4>
          <p>Nothing here yet. Explore the collection and choose a piece you will live with for years.</p>
          <button class="btn btn--dark" data-cart-shop>Explore the collection</button>
        </div>`;
      return;
    }

    const subtotal = cartSubtotal();
    const remaining = Math.max(0, FREE_DELIVERY - subtotal);
    const progress = Math.min(1, subtotal / FREE_DELIVERY);

    inner.innerHTML = `
      <div class="cart-progress">
        <p>${
          remaining > 0
            ? `You are <strong>${money.format(remaining)}</strong> away from complimentary white-glove delivery.`
            : `<strong>Complimentary white-glove delivery</strong> is included.`
        }</p>
        <div class="cart-progress__bar"><div class="cart-progress__fill" style="transform:scaleX(${progress})"></div></div>
      </div>
      <div class="cart-items">${state.cart.map(cartItemMarkup).join("")}</div>
      <div class="cart-footer">
        <div class="cart-subtotal"><span>Subtotal</span><strong>${money.format(subtotal)}</strong></div>
        <p class="cart-note">Taxes and delivery calculated at checkout. ${remaining === 0 ? "White-glove delivery is included." : ""}</p>
        <button class="btn btn--dark btn--block" data-checkout>Proceed to checkout ${ICON.arrow}</button>
        <button class="cart-continue" data-cart-close>Continue shopping</button>
        <p class="cart-secure">${ICON.lock} Secure checkout · 30-day returns</p>
      </div>`;

    if (!animate) {
      $$(".cart-item", inner).forEach((item) => {
        item.style.animation = "none";
      });
    }
  }

  function openCart() {
    if (cartOpen) return;
    if (menuOpen) closeMenu();
    if (modalOpen) closeModal();
    checkoutState = "idle";
    renderCart(false);
    drawerBackdrop.hidden = false;
    cartOpen = true;
    requestAnimationFrame(() => {
      drawerBackdrop.classList.add("is-open");
      cartDrawer.classList.add("is-open");
    });
    body.classList.add("cart-open");
    cartDrawer.setAttribute("aria-hidden", "false");
    nav.classList.remove("is-hidden");
    lastFocus = document.activeElement;
    window.setTimeout(() => {
      const close = $("#cartClose");
      if (close && cartOpen) close.focus({ preventScroll: true });
    }, 380);
  }

  function closeCart() {
    if (!cartOpen) return;
    cartOpen = false;
    drawerBackdrop.classList.remove("is-open");
    cartDrawer.classList.remove("is-open");
    body.classList.remove("cart-open");
    cartDrawer.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      if (!cartOpen) {
        drawerBackdrop.hidden = true;
        checkoutState = "idle";
        renderCart(false);
      }
    }, 760);
    if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
  }

  function addToCart(id, quantity = 1) {
    const product = productById(id);
    if (!product) return;
    const existing = state.cart.find((item) => item.id === id);
    if (existing) existing.qty = Math.min(99, existing.qty + quantity);
    else state.cart.push({ id, qty: Math.max(1, Math.min(99, quantity)) });
    saveJSON(CART_KEY, state.cart);
    renderCart(true);
    updateBadge(true);
    toast(`${product.name} added to your cart`);
  }

  function changeQuantity(id, delta) {
    const item = state.cart.find((entry) => entry.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) state.cart = state.cart.filter((entry) => entry.id !== id);
    saveJSON(CART_KEY, state.cart);
    renderCart(false);
    updateBadge(false);
  }

  function removeItem(id) {
    const product = productById(id);
    state.cart = state.cart.filter((item) => item.id !== id);
    saveJSON(CART_KEY, state.cart);
    renderCart(false);
    updateBadge(false);
    if (product) toast(`${product.name} removed from your cart`);
  }

  function startCheckout() {
    if (!state.cart.length || checkoutState === "processing") return;
    checkoutState = "processing";
    renderCart(false);
    window.setTimeout(() => {
      orderNumber = `MDM-${String(Date.now()).slice(-6)}`;
      state.cart = [];
      saveJSON(CART_KEY, state.cart);
      updateBadge(false);
      checkoutState = "success";
      renderCart(false);
      toast(`Order ${orderNumber} confirmed — thank you.`);
    }, 1700);
  }

  /* ---------- Testimonials ---------- */
  function initTestimonials() {
    const track = $("#testimonialTrack");
    const dots = $("#testDots");
    if (!track || !dots) return;

    track.innerHTML = TESTIMONIALS.map(
      (testimonial, index) => `
      <article class="testimonial" role="group" aria-roledescription="slide" aria-label="${index + 1} of ${TESTIMONIALS.length}">
        <div class="testimonial__stars">${ICON.star.repeat(5)}</div>
        <blockquote class="testimonial__quote">${testimonial.quote}</blockquote>
        <div class="testimonial__author">
          <span class="testimonial__name">${testimonial.name}</span>
          <span class="testimonial__loc">${testimonial.location}</span>
          <span class="testimonial__piece">${testimonial.piece}</span>
        </div>
      </article>`
    ).join("");

    dots.innerHTML = TESTIMONIALS.map(
      (_, index) => `
      <button class="testimonials__dot${index === 0 ? " is-active" : ""}" data-test="${index}" role="tab" aria-label="Review ${index + 1}" aria-selected="${index === 0}"></button>`
    ).join("");

    const total = $("#testTotal");
    if (total) total.textContent = pad(TESTIMONIALS.length);

    let index = 0;
    let timer = null;

    function go(nextIndex) {
      index = (nextIndex + TESTIMONIALS.length) % TESTIMONIALS.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      $$("#testDots .testimonials__dot").forEach((dot, dotIndex) => {
        const active = dotIndex === index;
        dot.classList.toggle("is-active", active);
        dot.setAttribute("aria-selected", String(active));
      });
      const current = $("#testCurrent");
      if (current) current.textContent = pad(index + 1);
    }

    function restart() {
      if (timer) window.clearInterval(timer);
      if (!prefersReduced.matches) timer = window.setInterval(() => go(index + 1), 7000);
    }

    $("#testNext").addEventListener("click", () => {
      go(index + 1);
      restart();
    });
    $("#testPrev").addEventListener("click", () => {
      go(index - 1);
      restart();
    });
    dots.addEventListener("click", (event) => {
      const dot = event.target.closest("[data-test]");
      if (!dot) return;
      go(parseInt(dot.dataset.test, 10));
      restart();
    });

    const wrap = $(".testimonials");
    if (wrap) {
      wrap.addEventListener("mouseenter", () => {
        if (timer) window.clearInterval(timer);
      });
      wrap.addEventListener("mouseleave", restart);
      wrap.addEventListener("focusin", () => {
        if (timer) window.clearInterval(timer);
      });
      wrap.addEventListener("focusout", restart);
    }

    const viewport = $(".testimonials__viewport");
    if (viewport) {
      let startX = null;
      viewport.addEventListener("pointerdown", (event) => {
        startX = event.clientX;
      });
      viewport.addEventListener("pointerup", (event) => {
        if (startX === null) return;
        const delta = event.clientX - startX;
        if (Math.abs(delta) > 50) {
          if (delta < 0) go(index + 1);
          else go(index - 1);
          restart();
        }
        startX = null;
      });
    }

    restart();
  }

  /* ---------- Forms ---------- */
  function initForms() {
    const contactForm = $("#contactForm");
    if (contactForm) {
      contactForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = $("#contactName");
        const email = $("#contactEmail");
        const message = $("#contactMessage");
        const note = $("#contactNote");
        const checks = [
          [name, name.value.trim().length > 1],
          [email, EMAIL_RE.test(email.value.trim())],
          [message, message.value.trim().length > 5],
        ];
        let valid = true;
        checks.forEach(([field, okay]) => {
          field.closest(".field").classList.toggle("has-error", !okay);
          if (!okay) valid = false;
        });
        if (!valid) {
          if (note) note.textContent = "Please complete the highlighted fields with a valid email address.";
          return;
        }
        const button = contactForm.querySelector("button[type='submit']");
        const original = button.innerHTML;
        button.disabled = true;
        button.textContent = "Sending…";
        if (note) note.textContent = "";
        window.setTimeout(() => {
          contactForm.reset();
          button.disabled = false;
          button.innerHTML = original;
          if (note) note.textContent = "Thank you — your enquiry is on its way. We reply within one working day.";
          toast("Enquiry received — we will be in touch.");
        }, 1200);
      });

      $$("input, textarea", contactForm).forEach((input) => {
        input.addEventListener("input", () => input.closest(".field").classList.remove("has-error"));
      });
    }

    const newsletter = $("#newsletterForm");
    if (newsletter) {
      newsletter.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = $("#newsletterEmail");
        const note = $("#newsletterNote");
        const email = input.value.trim();
        if (!EMAIL_RE.test(email)) {
          if (note) note.textContent = "Please enter a valid email address.";
          input.focus();
          return;
        }
        if (note) note.textContent = "Welcome to the house. Your first letter will arrive soon.";
        newsletter.reset();
        toast("You are on the list — welcome to MDM Furniture.");
      });
    }

    const aboutToggle = $("#aboutToggle");
    const aboutMore = $("#aboutMore");
    if (aboutToggle && aboutMore) {
      aboutToggle.addEventListener("click", () => {
        const open = aboutMore.classList.toggle("is-open");
        aboutMore.style.maxHeight = open ? aboutMore.scrollHeight + "px" : "";
        aboutToggle.setAttribute("aria-expanded", String(open));
        const label = aboutToggle.querySelector("span");
        if (label) label.textContent = open ? "Show less" : "Read our story";
      });
    }
  }

  /* ---------- Global actions ---------- */
  function initActions() {
    document.addEventListener("click", (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element) return;

      const view = element.closest("[data-view]");
      if (view) {
        openModal(view.getAttribute("data-view"));
        return;
      }

      const add = element.closest("[data-add]");
      if (add) {
        addToCart(add.getAttribute("data-add"));
        return;
      }

      const wishlist = element.closest("[data-wishlist]");
      if (wishlist) {
        toggleWishlist(wishlist.getAttribute("data-wishlist"));
        return;
      }

      const related = element.closest("[data-related]");
      if (related) {
        openModal(related.getAttribute("data-related"));
        return;
      }

      const gallery = element.closest("[data-gallery]");
      if (gallery) {
        setGalleryImage(parseInt(gallery.dataset.gallery, 10));
        return;
      }

      if (element.closest("[data-modal-minus]")) {
        modalQty = Math.max(1, modalQty - 1);
        updateModalQty();
        return;
      }

      if (element.closest("[data-modal-plus]")) {
        modalQty = Math.min(20, modalQty + 1);
        updateModalQty();
        return;
      }

      if (element.closest("[data-modal-add]") && currentProduct) {
        addToCart(currentProduct.id, modalQty);
        return;
      }

      if (element.closest("[data-close-modal]")) {
        closeModal();
        return;
      }

      const collection = element.closest("[data-collection]");
      if (collection) {
        applyFilterAndScroll(collection.dataset.collection);
        return;
      }

      const filterLink = element.closest("[data-filter-link]");
      if (filterLink) {
        applyFilterAndScroll(filterLink.dataset.filterLink);
        return;
      }

      if (element.closest("[data-cart-plus]")) {
        changeQuantity(element.closest("[data-cart-plus]").dataset.cartPlus, 1);
        return;
      }

      if (element.closest("[data-cart-minus]")) {
        changeQuantity(element.closest("[data-cart-minus]").dataset.cartMinus, -1);
        return;
      }

      if (element.closest("[data-cart-remove]")) {
        removeItem(element.closest("[data-cart-remove]").dataset.cartRemove);
        return;
      }

      if (element.closest("[data-checkout]")) {
        startCheckout();
        return;
      }

      if (element.closest("[data-cart-close]")) {
        closeCart();
        return;
      }

      if (element.closest("[data-cart-shop]")) {
        closeCart();
        setFilter("all");
        window.setTimeout(() => scrollToSection("#shop"), 420);
        return;
      }

      if (element.closest("[data-cart-continue]")) {
        closeCart();
        window.setTimeout(() => scrollToSection("#shop"), 420);
        return;
      }
    });

    document.addEventListener("click", (event) => {
      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
      if (!link) return;
      const hash = link.getAttribute("href");
      if (!hash || hash === "#") return;
      const target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      const wasMenuOpen = menuOpen;
      closeMenu();
      window.setTimeout(() => scrollToSection(hash), wasMenuOpen ? 380 : 0);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (modalOpen) closeModal();
        else if (cartOpen) closeCart();
        else if (menuOpen) closeMenu();
      }
    });

    menuToggle.addEventListener("click", toggleMenu);
    $("#cartToggle").addEventListener("click", openCart);
    $("#cartClose").addEventListener("click", closeCart);
    drawerBackdrop.addEventListener("click", closeCart);
    modalMainImage.addEventListener("error", () => {
      modalMainImage.src = FALLBACK_IMG;
    });
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });

    const backToTop = $("#backToTop");
    if (backToTop) {
      backToTop.addEventListener("click", () => scrollToSection("home"));
    }

    document.addEventListener(
      "error",
      (event) => {
        const image = event.target;
        if (image && image.tagName === "IMG" && !image.dataset.fallbackApplied) {
          image.dataset.fallbackApplied = "true";
          image.src = FALLBACK_IMG;
        }
      },
      true
    );

    window.addEventListener("resize", () => {
      applySmoothMode();
      if (window.innerWidth > 980 && menuOpen) closeMenu();
      const aboutMore = $("#aboutMore");
      if (aboutMore && aboutMore.classList.contains("is-open")) {
        aboutMore.style.maxHeight = aboutMore.scrollHeight + "px";
      }
    });

    if (smoothQuery.addEventListener) {
      smoothQuery.addEventListener("change", applySmoothMode);
    }
    if (prefersReduced.addEventListener) {
      prefersReduced.addEventListener("change", applySmoothMode);
    }
  }

  /* ---------- Boot ---------- */
  function boot() {
    revealElements = $$(".reveal, .reveal-clip");
    counterElements = $$(".stat__num[data-count]");

    applySmoothMode();
    initNav();
    initCollection();
    initStage();
    initTestimonials();
    initForms();
    initActions();
    renderCart(false);
    updateBadge(false);
    initPreloader();
    startRenderLoop();

    if ("ResizeObserver" in window && content) {
      const observer = new ResizeObserver(() => {
        if (smoothOn) measureContent();
      });
      observer.observe(content);
    }

    window.addEventListener("load", () => {
      if (smoothOn) measureContent();
      updateReveals();
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (smoothOn) measureContent();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
