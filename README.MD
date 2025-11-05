\# Family Gift Registry



A lightweight, single-page gift registry crafted especially for organizing thoughtful surprises for my wife and kids.



\## Features

\- ✨ Curated inspiration section with filters for wife, kids, and gift types

\- ✅ Interactive wishlist that tracks purchased items, budgets, and notes

\- ➕ Form to add personalized gift ideas (saved locally in the browser)

\- 🗓️ Planner timeline with upcoming celebrations and automatic countdown



\## Quick Adding with the Bookmarklet

To quickly add gifts from any website, you can use the special bookmarklet. Drag the following link to your browser's bookmarks bar:

[Add to Gift Registry](javascript:(() => { const title = document.querySelector('h1')?.innerText || document.title; const priceMatch = document.body.innerText.match(/\$(\d+\.\d{2})/); const price = priceMatch ? priceMatch[1] : ''; const url = window.location.href; const registryUrl = new URL('http://localhost:8000/index.html'); registryUrl.searchParams.set('action', 'add'); registryUrl.searchParams.set('name', title); registryUrl.searchParams.set('price', price); registryUrl.searchParams.set('link', url); window.open(registryUrl, '_blank'); })())

When you're on a product page you want to add, simply click the "Add to Gift Registry" bookmark. A new tab will open with the gift form pre-filled with the item's name, price, and a link.

