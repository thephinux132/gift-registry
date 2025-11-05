"use strict";

import { 
  db, 
  auth, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  onAuthStateChanged,
  signOut
} from './firebase-init.js';

onAuthStateChanged(auth, user => {
  if (user) {
    init();
  } else {
    window.location.href = "login.html";
  }
});

function init() {
  const giftsCollection = collection(db, "gifts");

  const wishlistContainer = document.getElementById("wishlist-container");

  const statEls = {
    total: document.querySelector("[data-stat-total]"),
    purchased: document.querySelector("[data-stat-purchased]"),
    remaining: document.querySelector("[data-stat-remaining]"),
    budget: document.querySelector("[data-stat-budget]")
  };

  const form = document.getElementById("gift-form");
  const logoutBtn = document.getElementById("logout-btn");
  const giftTypeSelector = document.getElementById("gift-type");
  const goalAmountGroup = document.getElementById("goal-amount-group");

  giftTypeSelector.addEventListener("change", () => {
    const selectedType = giftTypeSelector.value;
    if (selectedType === "Group" || selectedType === "Cash") {
      goalAmountGroup.style.display = "block";
    } else {
      goalAmountGroup.style.display = "none";
    }
  });

  let gifts = [];

  function normalizePrice(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatCurrency(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "N/A";
    }
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
    } catch (error) {
      return `$${value.toFixed(2)}`;
    }
  }

  function renderLists() {
    wishlistContainer.innerHTML = "";
    const grouped = {};
    for (const gift of gifts) {
      const recipient = gift.recipient || "Uncategorized";
      if (!grouped[recipient]) {
        grouped[recipient] = [];
      }
      grouped[recipient].push(gift);
    }

    const sortedRecipients = Object.keys(grouped).sort();

    for (const recipient of sortedRecipients) {
      const items = grouped[recipient];
      items.sort(sortByPurchasedThenPriority);

      const listSection = document.createElement("section");
      listSection.className = "wishlist__column";
      listSection.setAttribute("aria-labelledby", `list-title-${recipient}`);

      const header = document.createElement("div");
      header.className = "column__header";

      const title = document.createElement("h3");
      title.id = `list-title-${recipient}`;
      title.textContent = recipient;

      const count = document.createElement("span");
      count.className = "column__count";
      count.textContent = summaryText(items.length);

      header.append(title, count);

      const listElement = document.createElement("ul");
      listElement.className = "gift-list";

      listSection.append(header, listElement);
      wishlistContainer.append(listSection);

      updateList(listElement, items);
    }
  }

  const priorityWeight = { High: 0, Medium: 1, Low: 2 };

  function sortByPurchasedThenPriority(a, b) {
    if (a.purchased !== b.purchased) {
      return a.purchased ? 1 : -1;
    }
    const weightA = priorityWeight[a.priority] ?? 1;
    const weightB = priorityWeight[b.priority] ?? 1;
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    return new Date(a.added).getTime() - new Date(b.added).getTime();
  }

  function summaryText(count) {
    if (count === 0) {
      return "No items yet";
    }
    return `${count} ${count === 1 ? "item" : "items"}`;
  }

  function createProgressBar(goal, contributions) {
    const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0);
    const percentage = goal > 0 ? (totalContributions / goal) * 100 : 0;

    const progressContainer = document.createElement("div");
    progressContainer.className = "progress-bar";

    const progressIndicator = document.createElement("div");
    progressIndicator.className = "progress-bar__indicator";
    progressIndicator.style.width = `${percentage}%`;

    progressContainer.append(progressIndicator);

    const progressText = document.createElement("span");
    progressText.className = "progress-bar__text";
    progressText.textContent = `${formatCurrency(totalContributions)} / ${formatCurrency(goal)}`;

    return [progressContainer, progressText];
  }

  function updateList(listElement, items) {
    listElement.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "gift-item gift-item--empty";
      empty.textContent = "Add the first idea to get started.";
      listElement.append(empty);
      return;
    }

    for (const gift of items) {
      const item = document.createElement("li");
      item.className = "gift-item";
      if (gift.purchased) {
        item.classList.add("gift-item--purchased");
      }

      const header = document.createElement("div");
      header.className = "gift-item__header";

      const name = document.createElement("span");
      name.className = "gift-item__name";
      name.textContent = gift.name;

      const badge = document.createElement("span");
      badge.className = "gift-item__badge";
      badge.textContent = `${gift.priority} priority`;

      header.append(name, badge);

      const meta = document.createElement("div");
      meta.className = "gift-item__meta";

      const category = document.createElement("span");
      category.innerHTML = `<span aria-hidden="true">🏷️</span>${gift.category}`;
      meta.append(category);

      if (gift.event) {
        const event = document.createElement("span");
        event.innerHTML = `<span aria-hidden="true">🎉</span>${gift.event}`;
        meta.append(event);
      }

      if (gift.type === "Group" || gift.type === "Cash") {
        const [progressBar, progressText] = createProgressBar(gift.goal, gift.contributions || []);
        meta.append(progressBar, progressText);
      } else if (typeof gift.price === "number" && !Number.isNaN(gift.price)) {
        const price = document.createElement("span");
        price.innerHTML = `<span aria-hidden="true">💰</span>${formatCurrency(gift.price)}`;
        meta.append(price);
      }

      const added = document.createElement("span");
      const addedDate = new Date(gift.added);
      const friendlyDate = !Number.isNaN(addedDate.getTime())
        ? addedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "Recently added";
      added.innerHTML = `<span aria-hidden="true">🗓️</span>${friendlyDate}`;
      meta.append(added);

      const actions = document.createElement("div");
      actions.className = "gift-item__actions";

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "toggle-purchased";
      toggleBtn.textContent = gift.purchased ? "Purchased" : "Mark purchased";
      if (gift.purchased) {
        toggleBtn.classList.add("is-complete");
      }
      toggleBtn.addEventListener("click", () => {
        const giftRef = doc(db, "gifts", gift.id);
        updateDoc(giftRef, { purchased: !gift.purchased });
      });
      
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn--ghost";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete this gift?")) {
          const giftRef = doc(db, "gifts", gift.id);
          deleteDoc(giftRef);
        }
      });

      actions.append(toggleBtn, deleteBtn);

      if (gift.link) {
        const link = document.createElement("a");
        link.href = gift.link;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Open link";
        actions.append(link);
      }

      if (gift.notes) {
        const notes = document.createElement("p");
        notes.className = "gift-item__notes";
        notes.textContent = gift.notes;
        item.append(header, meta, notes, actions);
      } else {
        item.append(header, meta, actions);
      }

      listElement.append(item);
    }
  }

  function updateStats() {
    const total = gifts.length;
    const purchased = gifts.filter((gift) => gift.purchased).length;
    const budget = gifts.reduce((sum, gift) => {
      if (gift.type === "Group" || gift.type === "Cash") {
        return sum + (gift.goal || 0);
      }
      return sum + (gift.price || 0);
    }, 0);
    statEls.total.textContent = total;
    statEls.purchased.textContent = purchased;
    statEls.remaining.textContent = Math.max(total - purchased, 0);
    statEls.budget.textContent = formatCurrency(budget);
  }

  function render() {
    renderLists();
    updateStats();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(form);
    const name = formData.get("name").trim();
    if (!name) {
      return;
    }

    const newGift = {
      name,
      recipient: formData.get("recipient").trim(),
      category: formData.get("category").trim(),
      event: formData.get("event").trim(),
      priority: formData.get("priority"),
      type: formData.get("type"),
      price: normalizePrice(formData.get("price")),
      goal: normalizePrice(formData.get("goal")),
      contributions: [],
      link: (formData.get("link") || "").trim(),
      notes: (formData.get("notes") || "").trim(),
      purchased: false,
      added: new Date().toISOString()
    };

    await addDoc(giftsCollection, newGift);
    form.reset();
    form.querySelector("[name='name']").focus();
  }

  function setupInspirationSection() {
    const grid = document.querySelector("[data-featured-grid]");
    const filterButtons = document.querySelectorAll(".filter-btn");
    let cards = [];

    async function loadInspiration() {
      try {
        const response = await fetch("inspiration.json");
        const inspirationItems = await response.json();
        renderInspiration(inspirationItems);
      } catch (error) {
        console.error("Error loading inspiration items:", error);
        grid.innerHTML = "<p>Could not load inspiration items.</p>";
      }
    }

    function renderInspiration(items) {
      grid.innerHTML = "";
      items.forEach(item => {
        const card = document.createElement("article");
        card.className = "gift-card";
        card.dataset.groups = item.groups.join(" ");

        card.innerHTML = `
          <div class="gift-card__tag">${item.tag}</div>
          <h3>${item.name}</h3>
          <p>${item.description}</p>
          <div class="gift-card__meta">
            <span>${formatCurrency(item.price)}</span>
            <a href="${item.link}" target="_blank" rel="noopener">View inspiration</a>
          </div>
        `;
        grid.append(card);
      });
      cards = Array.from(grid.querySelectorAll(".gift-card"));
      applyFilter("all");
    }

    function applyFilter(group) {
      cards.forEach((card) => {
        const groups = (card.dataset.groups || "").split(/\s+/);
        const show = group === "all" || groups.includes(group);
        card.style.display = show ? "flex" : "none";
      });
    }

    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterButtons.forEach((button) => button.classList.remove("is-active"));
        btn.classList.add("is-active");
        applyFilter(btn.dataset.filter || "all");
      });
    });

    loadInspiration();
  }

  function setupCountdown() {
    const countdownRoot = document.querySelector("[data-countdown]");
    if (!countdownRoot) {
      return;
    }

    const dayEl = countdownRoot.querySelector("[data-countdown-days]");
    const hourEl = countdownRoot.querySelector("[data-countdown-hours]");
    const minuteEl = countdownRoot.querySelector("[data-countdown-minutes]");

    function nextEventDate() {
      const now = new Date();
      const target = new Date(now.getFullYear(), 4, 24, 9, 0, 0); // May 24, 9 AM
      if (target.getTime() <= now.getTime()) {
        target.setFullYear(target.getFullYear() + 1);
      }
      return target;
    }

    let targetDate = nextEventDate();

    function tick() {
      const now = new Date();
      if (now.getTime() >= targetDate.getTime()) {
        targetDate = nextEventDate();
      }
      const diff = targetDate.getTime() - now.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const days = Math.floor(minutes / (60 * 24));
      const hours = Math.floor((minutes - days * 24 * 60) / 60);
      const remainingMinutes = minutes % 60;
      dayEl.textContent = String(days).padStart(2, "0");
      hourEl.textContent = String(hours).padStart(2, "0");
      minuteEl.textContent = String(remainingMinutes).padStart(2, "0");
    }

    tick();
    setInterval(tick, 60000);
  }

  function setupRealtimeListener() {
    onSnapshot(giftsCollection, snapshot => {
      gifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      render();
    }, error => {
      console.error("Error fetching gifts:", error);
    });
  }

  function handleBookmarklet() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("action") === "add") {
      form.name.value = urlParams.get("name") || "";
      form.price.value = urlParams.get("price") || "";
      form.link.value = urlParams.get("link") || "";
      form.name.focus();

      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  form.addEventListener("submit", handleSubmit);
  logoutBtn.addEventListener("click", () => {
    signOut(auth);
  });

  setupInspirationSection();
  setupCountdown();
  setupRealtimeListener();
  handleBookmarklet();
}
