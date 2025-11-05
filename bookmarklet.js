javascript:(() => {
  const title = document.querySelector('h1')?.innerText || document.title;
  const priceMatch = document.body.innerText.match(/\$(\d+\.\d{2})/);
  const price = priceMatch ? priceMatch[1] : '';
  const url = window.location.href;

  const registryUrl = new URL('http://localhost:8000/index.html');
  registryUrl.searchParams.set('action', 'add');
  registryUrl.searchParams.set('name', title);
  registryUrl.searchParams.set('price', price);
  registry_url.searchParams.set('link', url);

  window.open(registryUrl, '_blank');
})();