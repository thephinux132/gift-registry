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

  const lists = {
    wife: document.querySelector('[data-recipient-list="wife"]'),
    kids: document.querySelector('[data-recipient-list="kids"]')
  };

  const countLabels = {
    wife: document.querySelector("[data-count-wife]"),
    kids: document.querySelector("[data-count-kids]")
  };

  const statEls = {
    total: document.querySelector("[data-stat-total]"),
    purchased: document.querySelector("[data-stat-purchased]"),
    remaining: document.querySelector("[data-stat-remaining]"),
    budget: document.querySelector("[data-stat-budget]")
  };

  const form = document.getElementById("gift-form");
  const logoutBtn = document.getElementById("logout-btn");

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
    const grouped = { wife: [], kids: [] };
    for (const gift of gifts) {
      grouped[gift.recipient].push(gift);
    }

    grouped.wife.sort(sortByPurchasedThenPriority);
    grouped.kids.sort(sortByPurchasedThenPriority);

    updateList(lists.wife, grouped.wife);
    updateList(lists.kids, grouped.kids);

    countLabels.wife.textContent = summaryText(grouped.wife.length);
    countLabels.kids.textContent = summaryText(grouped.kids.length);
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

      if (typeof gift.price === "number" && !Number.isNaN(gift.price)) {
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
    const budget = gifts.reduce((sum, gift) => (typeof gift.price === "number" ? sum + gift.price : sum), 0);
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
      recipient: formData.get("recipient"),
      category: formData.get("category"),
      priority: formData.get("priority"),
      price: normalizePrice(formData.get("price")),
      link: (formData.get("link") || "").trim(),
      notes: (formData.get("notes") || "").trim(),
      purchased: false,
      added: new Date().toISOString()
    };

    await addDoc(giftsCollection, newGift);
    form.reset();
    form.querySelector("[name='name']").focus();
  }

  function setupFeaturedFilters() {
    const filterButtons = document.querySelectorAll(".filter-btn");
    const cards = document.querySelectorAll("[data-featured-grid] .gift-card");

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

    const activeButton = document.querySelector(".filter-btn.is-active");
    applyFilter(activeButton?.dataset.filter || "all");
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

  form.addEventListener("submit", handleSubmit);
  logoutBtn.addEventListener("click", () => {
    signOut(auth);
  });

  setupFeaturedFilters();
  setupCountdown();
  setupRealtimeListener();
}
