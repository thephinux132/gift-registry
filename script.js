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

const giftsCollection = collection(db, "gifts");

onAuthStateChanged(auth, user => {
  if (user) {
    console.log("User is logged in:", user.uid);
    init();
  } else {
    console.log("User is logged out");
    window.location.href = "login.html";
  }
});

function init() {

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

  function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
  }

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

  const groupBySelector = document.getElementById("group-by");

  groupBySelector.addEventListener("change", () => {
    render();
  });

  function renderLists(groupBy = "recipient") {
    while (wishlistContainer.firstChild) {
      wishlistContainer.removeChild(wishlistContainer.firstChild);
    }
    const grouped = {};
    for (const gift of gifts) {
      const key = gift[groupBy] || "Uncategorized";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(gift);
    }

    const sortedKeys = Object.keys(grouped).sort();

    for (const key of sortedKeys) {
      const items = grouped[key];
      items.sort(sortByPurchasedThenPriority);

      const listSection = document.createElement("section");
      listSection.className = "wishlist__column";
      listSection.setAttribute("aria-labelledby", `list-title-${key}`);

      const header = document.createElement("div");
      header.className = "column__header";

      const title = document.createElement("h3");
      title.id = `list-title-${key}`;
      title.textContent = key;

      const count = document.createElement("span");
      count.className = "column__count";
      count.textContent = summaryText(items.length);

      const aiButton = document.createElement("button");
      aiButton.className = "btn btn--ghost";
      aiButton.textContent = "Get AI Suggestions";
      aiButton.addEventListener("click", () => getAISuggestions(key, items));

      header.append(title, count, aiButton);

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

  const editModal = document.getElementById("edit-gift-modal");
  const editForm = document.getElementById("edit-gift-form");
  const closeModalBtn = editModal.querySelector(".close-button");
  const editGiftTypeSelector = document.getElementById("edit-gift-type");
  const editGoalAmountGroup = document.getElementById("edit-goal-amount-group");

  const aiSuggestionsModal = document.getElementById("ai-suggestions-modal");
  const aiSuggestionsList = document.getElementById("ai-suggestions-list");
  const closeAISuggestionsModalBtn = aiSuggestionsModal.querySelector(".close-button");

  function getAISuggestions(recipient, existingGifts) {
    // In a real application, this would call an AI model.
    // Here, we'll simulate it with a predefined list.
    const suggestions = [
      { name: "A good book", category: "Learning" },
      { name: "A subscription box", category: "Experience" },
      { name: "A weekend getaway", category: "Experience" },
      { name: "A cooking class", category: "Learning" },
      { name: "A personalized photo album", category: "Keepsake" },
    ];

    aiSuggestionsList.innerHTML = ""; // Clear previous suggestions

    for (const suggestion of suggestions) {
      const suggestionEl = document.createElement("div");
      suggestionEl.className = "suggestion-item";
      suggestionEl.innerHTML = `
        <p><strong>${suggestion.name}</strong></p>
        <p>Category: ${suggestion.category}</p>
        <button class="btn btn--primary add-suggestion-btn">Add to Wishlist</button>
      `;
      suggestionEl.querySelector(".add-suggestion-btn").addEventListener("click", () => {
        const newGift = {
          name: suggestion.name,
          recipient: recipient,
          category: suggestion.category,
          event: "",
          date: "",
          priority: "Medium",
          type: "Individual",
          price: null,
          goal: null,
          contributions: [],
          link: "",
          notes: "AI Suggested",
          purchased: false,
          added: new Date().toISOString(),
          addedBy: auth.currentUser.uid
        };
        addDoc(giftsCollection, newGift);
        closeAISuggestionsModal();
      });
      aiSuggestionsList.appendChild(suggestionEl);
    }

    aiSuggestionsModal.style.display = "block";
  }

  function closeAISuggestionsModal() {
    aiSuggestionsModal.style.display = "none";
  }

  closeAISuggestionsModalBtn.addEventListener("click", closeAISuggestionsModal);
  window.addEventListener("click", (event) => {
    if (event.target == aiSuggestionsModal) {
      closeAISuggestionsModal();
    }
  });

  editGiftTypeSelector.addEventListener("change", () => {
    const selectedType = editGiftTypeSelector.value;
    if (selectedType === "Group" || selectedType === "Cash") {
      editGoalAmountGroup.style.display = "block";
    } else {
      editGoalAmountGroup.style.display = "none";
    }
  });

  function openEditModal(gift) {
    editForm.id.value = gift.id;
    editForm.name.value = gift.name;
    editForm.recipient.value = gift.recipient;
    editForm.category.value = gift.category;
    editForm.event.value = gift.event;
    editForm.date.value = gift.date;
    editForm.type.value = gift.type;
    editForm.goal.value = gift.goal;
    editForm.link.value = gift.link;
    editForm.notes.value = gift.notes;

    if (gift.type === "Group" || gift.type === "Cash") {
      editGoalAmountGroup.style.display = "block";
    } else {
      editGoalAmountGroup.style.display = "none";
    }
    
    editModal.style.display = "block";
  }

  function closeEditModal() {
    editModal.style.display = "none";
  }

  closeModalBtn.addEventListener("click", closeEditModal);
  window.addEventListener("click", (event) => {
    if (event.target == editModal) {
      closeEditModal();
    }
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(editForm);
    const giftId = formData.get("id");
    
    const updatedGift = {
      name: formData.get("name").trim(),
      recipient: formData.get("recipient").trim(),
      category: formData.get("category").trim(),
      event: formData.get("event").trim(),
      date: formData.get("date"),
      type: formData.get("type"),
      goal: normalizePrice(formData.get("goal")),
      link: (formData.get("link") || "").trim(),
      notes: (formData.get("notes") || "").trim(),
    };

    const giftRef = doc(db, "gifts", giftId);
    await updateDoc(giftRef, updatedGift);
    
    closeEditModal();
  });

  function updateList(listElement, items) {
    while (listElement.firstChild) {
      listElement.removeChild(listElement.firstChild);
    }
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
      const categoryIcon = document.createElement("span");
      categoryIcon.setAttribute("aria-hidden", "true");
      categoryIcon.textContent = "🏷️";
      category.append(categoryIcon, sanitizeHTML(gift.category));
      meta.append(category);

      if (gift.event) {
        const event = document.createElement("span");
        const eventIcon = document.createElement("span");
        eventIcon.setAttribute("aria-hidden", "true");
        eventIcon.textContent = "🎉";
        event.append(eventIcon, sanitizeHTML(gift.event));
        meta.append(event);
      }

      if (gift.type === "Group" || gift.type === "Cash") {
        const [progressBar, progressText] = createProgressBar(gift.goal, gift.contributions || []);
        meta.append(progressBar, progressText);
      } else if (typeof gift.price === "number" && !Number.isNaN(gift.price)) {
        const price = document.createElement("span");
        const priceIcon = document.createElement("span");
        priceIcon.setAttribute("aria-hidden", "true");
        priceIcon.textContent = "💰";
        price.append(priceIcon, formatCurrency(gift.price));
        meta.append(price);
      }

      const added = document.createElement("span");
      const addedIcon = document.createElement("span");
      addedIcon.setAttribute("aria-hidden", "true");
      addedIcon.textContent = "🗓️";
      const addedDate = new Date(gift.added);
      const friendlyDate = !Number.isNaN(addedDate.getTime())
        ? addedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "Recently added";
      added.append(addedIcon, friendlyDate);
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
                    updateDoc(giftRef, { purchased: !gift.purchased });      });
      
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn--ghost";
      deleteBtn.textContent = "Delete";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn--ghost";
      editBtn.textContent = "Edit";

      const user = auth.currentUser;
      if (user && user.uid === gift.addedBy) {
        deleteBtn.addEventListener("click", () => {
          if (confirm("Are you sure you want to delete this gift?")) {
            const giftRef = doc(db, "gifts", gift.id);
            deleteDoc(giftRef);
          }
        });
        editBtn.addEventListener("click", () => {
          openEditModal(gift);
        });
      } else {
        deleteBtn.style.display = "none";
        editBtn.style.display = "none";
      }

      actions.append(toggleBtn, editBtn, deleteBtn);

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

  let currentDate = new Date();

  function renderCalendar(year, month) {
    const calendarContainer = document.getElementById("calendar-container");
    const currentMonthYearEl = document.getElementById("current-month-year");

    calendarContainer.innerHTML = ""; // Clear previous calendar

    currentMonthYearEl.textContent = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    // Add day names
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (const dayName of dayNames) {
        const dayNameEl = document.createElement("div");
        dayNameEl.className = "calendar-day-name";
        dayNameEl.textContent = dayName;
        calendarContainer.appendChild(dayNameEl);
    }

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "calendar-day calendar-day--empty";
      calendarContainer.appendChild(emptyCell);
    }

    // Add day cells
    for (let i = 1; i <= daysInMonth; i++) {
      const dayCell = document.createElement("div");
      dayCell.className = "calendar-day";
      dayCell.innerHTML = `<h4>${i}</h4>`;
      calendarContainer.appendChild(dayCell);
    }

    populateCalendarWithEvents(year, month);
  }

  function populateCalendarWithEvents(year, month) {
    const calendarContainer = document.getElementById("calendar-container");
    const dayCells = calendarContainer.querySelectorAll('.calendar-day:not(.calendar-day--empty)');
    const giftsWithDates = gifts.filter(gift => gift.date);

    for (const gift of giftsWithDates) {
      const eventDate = new Date(gift.date);
      if (eventDate.getFullYear() === year && eventDate.getMonth() === month) {
        const dayOfMonth = eventDate.getDate();
        const dayCell = dayCells[dayOfMonth - 1];
        if (dayCell) {
          const eventEl = document.createElement("div");
          eventEl.className = "calendar-event";
          eventEl.textContent = gift.name;
          dayCell.appendChild(eventEl);
        }
      }
    }
  }

  const prevMonthBtn = document.getElementById("prev-month-btn");
  const nextMonthBtn = document.getElementById("next-month-btn");

  function showPrevMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
  }

  function showNextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
  }

  prevMonthBtn.addEventListener("click", showPrevMonth);
  nextMonthBtn.addEventListener("click", showNextMonth);

  function render() {
    const groupBy = groupBySelector.value;
    renderLists(groupBy);
    updateStats();
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(form);
    const name = formData.get("name").trim();
    if (!name) {
      return;
    }

    const user = auth.currentUser;
    if (!user) {
        console.error("No user logged in");
        return;
    }

    const newGift = {
      name,
      recipient: formData.get("recipient").trim(),
      category: formData.get("category").trim(),
      event: formData.get("event").trim(),
      date: formData.get("date"),
      priority: formData.get("priority"),
      type: formData.get("type"),
      price: normalizePrice(formData.get("price")),
      goal: normalizePrice(formData.get("goal")),
      contributions: [],
      link: (formData.get("link") || "").trim(),
      notes: (formData.get("notes") || "").trim(),
      purchased: false,
      added: new Date().toISOString(),
      addedBy: user.uid
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
        while (grid.firstChild) {
        grid.removeChild(grid.firstChild);
      }
        const errorEl = document.createElement("p");
        errorEl.textContent = "Could not load inspiration items.";
        grid.append(errorEl);
      }
    }

    function renderInspiration(items) {
      while (grid.firstChild) {
        grid.removeChild(grid.firstChild);
      }
      items.forEach(item => {
        const card = document.createElement("article");
        card.className = "gift-card";
        card.dataset.groups = item.groups.join(" ");

        const tag = document.createElement('div');
        tag.className = 'gift-card__tag';
        tag.textContent = item.tag;

        const name = document.createElement('h3');
        name.textContent = item.name;

        const description = document.createElement('p');
        description.textContent = item.description;

        const meta = document.createElement('div');
        meta.className = 'gift-card__meta';

        const price = document.createElement('span');
        price.textContent = formatCurrency(item.price);

        const link = document.createElement('a');
        link.href = item.link;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'View inspiration';

        meta.append(price, link);
        card.append(tag, name, description, meta);
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
    console.log("Logout button clicked");
    signOut(auth);
  });

  setupInspirationSection();
  setupCountdown();
  setupRealtimeListener();
  handleBookmarklet();
}
