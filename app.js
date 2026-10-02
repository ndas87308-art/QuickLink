const STORAGE_KEY = 'orbit-store-v1';
const defaultCategories = ['Electronics', 'Fashion', 'Home', 'Appliances', 'Books', 'Beauty', 'Sports'];
const defaultBanners = [
  { id: 'b1', tag: 'A NEW WAY TO DISCOVER', title: 'Big days.\nBright finds.', description: 'Your next favourite is waiting to be added.', button: 'Explore categories' },
  { id: 'b2', tag: 'A SHOP THAT STARTS WITH YOU', title: 'A little more\neveryday joy.', description: 'Browse categories and see what inspires you.', button: 'Explore categories' },
  { id: 'b3', tag: 'YOUR SPACE TO EXPLORE', title: 'Find your\nnext thing.', description: 'Your catalogue appears here when products are added.', button: 'Explore categories' }
];
const defaults = { products: [], users: [], orders: [], cart: {}, categories: defaultCategories, sections: [], banners: defaultBanners, settings: { name: 'orbit.', tagline: 'Good finds for your everyday.', supportEmail: '', currency: '₹', announcement: '' } };
let state = readState();
let activeCategory = 'All';
let activeAdminTab = 'products';
let adminSearch = '';
let adminFilter = 'all';
let editingProductId = null;
let bannerIndex = 0;
let bannerTransitionTimer;
let toastTimer;

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...defaults, ...saved, cart: saved.cart || {}, categories: saved.categories || defaultCategories, sections: saved.sections || [], banners: saved.banners?.length ? saved.banners : defaultBanners, settings: { ...defaults.settings, ...(saved.settings || {}) } };
  } catch { return JSON.parse(JSON.stringify(defaults)); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function esc(value = '') { return String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]); }
function money(value) { return `${state.settings.currency || '₹'}${Number(value || 0).toLocaleString('en-IN')}`; }
function uid() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function toast(message) { const node = document.querySelector('#toast'); node.textContent = message; node.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 2400); }
function cartQuantity() { return Object.values(state.cart).reduce((sum, amount) => sum + Number(amount || 0), 0); }
function updateCartCount() { document.querySelector('#cartCount').textContent = cartQuantity(); }

function filteredProducts() {
  const query = document.querySelector('#searchInput').value.trim().toLowerCase();
  const maxPrice = Number(document.querySelector('#priceRange').value);
  const sort = document.querySelector('#sortSelect').value;
  let list = state.products.filter((p) => (activeCategory === 'All' || p.category === activeCategory) && (!query || `${p.name} ${p.category} ${p.description || ''}`.toLowerCase().includes(query)) && Number(p.price) <= maxPrice);
  if (sort === 'price-low') list.sort((a,b) => a.price - b.price);
  if (sort === 'price-high') list.sort((a,b) => b.price - a.price);
  if (sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name));
  if (sort === 'newest') list.sort((a,b) => b.createdAt - a.createdAt);
  return list;
}
function renderProducts() {
  const grid = document.querySelector('#productGrid'); const list = filteredProducts();
  const query = document.querySelector('#searchInput').value.trim();
  document.querySelector('#catalogTitle').textContent = activeCategory === 'All' ? 'Discover products' : activeCategory;
  document.querySelector('#catalogSubtitle').textContent = query ? `Search results for “${query}”` : 'The latest finds, all in one place';
  document.querySelector('#resultCount').textContent = list.length ? `${list.length} item${list.length === 1 ? '' : 's'}` : '';
  if (!list.length) {
    const hasProducts = state.products.length > 0;
    grid.innerHTML = `<div class="empty-catalog"><div class="empty-graphic">${hasProducts ? '⌕' : '◈'}</div><h3>${hasProducts ? 'No products match these filters' : 'Your catalogue is ready for its first product'}</h3><p>${hasProducts ? 'Try another search or clear your filters.' : 'Products added by your admin will appear here. No sample products are included.'}</p>${hasProducts ? '<button class="primary-button" id="emptyClear">Clear filters</button>' : ''}</div>`;
    document.querySelector('#emptyClear')?.addEventListener('click', clearFilters); return;
  }
  grid.innerHTML = list.map((p, index) => {
    const art = ['◈','○','▣','□','◎','◇'][index % 6];
    const image = p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove();this.nextElementSibling.hidden=false"><span class="placeholder-art" hidden>${art}</span>` : `<span class="placeholder-art">${art}</span>`;
    return `<article class="product-card" style="animation-delay:${Math.min(index*45,360)}ms"><div class="product-image">${image}</div><div class="product-name" title="${esc(p.name)}">${esc(p.name)}</div><div class="product-category">${esc(p.category)}</div><div class="product-price">${money(p.price)}</div><div class="stock-label ${p.stock < 1 ? 'out' : ''}">${p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</div><div class="product-actions"><button class="buy-button" data-buy="${esc(p.id)}" ${p.stock < 1 ? 'disabled' : ''}>Buy now</button><button class="add-button" data-add="${esc(p.id)}" ${p.stock < 1 ? 'disabled' : ''}>Add to cart</button></div></article>`;
  }).join('');
  grid.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addToCart(b.dataset.add)));
  grid.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => checkout([{ id: b.dataset.buy, quantity: 1 }])));
}
function categoryIcon(label) {
  const name=label.toLowerCase();
  const paths={
    all:'<path d="M8 3h8l4 4-1 14H5L4 7l4-4Z"/><path class="accent" d="M8 3c0 3 2 5 4 5s4-2 4-5"/>',
    fashion:'<path d="m8 4 4 2 4-2 5 4-3 5-2-2v10H8V11l-2 2-3-5 5-4Z"/><path class="accent" d="M9 5c0 2 1 4 3 4s3-2 3-4"/>',
    mobile:'<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 5h4M10 18.5h4"/><path class="accent" d="M7.5 7h9"/>',
    electronics:'<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M9 21h6m-3-4v4"/><path class="accent" d="M5 6h14"/>',
    beauty:'<path d="M9 3h6v4H9zM8 7h8l1 13H7L8 7Z"/><path d="M10 3V1h4v2"/><path class="accent" d="M8 11h8"/>',
    home:'<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/><path class="accent" d="m3 11 9-8 9 8"/>',
    appliance:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14M8 5.5h.01"/><circle cx="12" cy="14" r="4"/><path class="accent" d="M9 14h6"/>',
    toys:'<circle cx="12" cy="12" r="6"/><circle cx="5" cy="5" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="10" cy="11" r=".6"/><circle cx="14" cy="11" r=".6"/><path d="M10 14c1.3 1.2 2.7 1.2 4 0"/><path class="accent" d="M5 5l3 3m11-3-3 3"/>',
    food:'<path d="M6 7h12l1 13H5L6 7Z"/><path d="M8 7V4h8v3m-5-3V2h2v2"/><path class="accent" d="M7 11h10"/>',
    auto:'<path d="m4 14 2-6h12l2 6v5H4v-5Z"/><path d="M7 8l1-3h8l1 3M4 14h16M7 19v2m10-2v2"/><circle cx="7" cy="15.5" r="1"/><circle cx="17" cy="15.5" r="1"/><path class="accent" d="M8 10h8"/>',
    sports:'<circle cx="12" cy="12" r="9"/><path d="m8 4 2 5 5 1 3-4M3.5 9l4.5 2 1 5-4 3m15.5-9-4 2-1 5 4 3"/><path class="accent" d="m8 4 2 5 5 1"/>',
    furniture:'<path d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M4 11h16v5H4zM6 16v5m12-5v5"/><path class="accent" d="M7 9h10"/>',
    books:'<path d="M4 5a2 2 0 0 1 2-2h14v17H6a2 2 0 0 1-2-2V5Z"/><path d="M4 17a2 2 0 0 1 2-2h14M8 7h8m-8 3h6"/><path class="accent" d="M6 3v12"/>',
    wheels:'<circle cx="6" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="m6 17 4-7h5l4 7m-9-7-2-3h5l2 3m-5 0h5"/><path class="accent" d="M10 10h5"/>',
    meat:'<path d="M5 8c2-3 6-4 10-2l4 3c3 2 2 7-1 9-3 2-7 2-10 0l-3-2c-3-2-3-5 0-8Z"/><circle cx="15.5" cy="12" r="2.5"/><path class="accent" d="M5 8 3 6m3 12-2 2"/>',
    default:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 4v16"/><path class="accent" d="M9 9h11"/>'
  };
  let key='default';
  if(/for you|all/.test(name))key='all';else if(/fashion|cloth|wear/.test(name))key='fashion';else if(/mobile|phone/.test(name))key='mobile';else if(/electronic|computer|laptop|tv/.test(name))key='electronics';else if(/beauty|make.?up|cosmetic/.test(name))key='beauty';else if(/home|living|lamp/.test(name))key='home';else if(/appliance/.test(name))key='appliance';else if(/toy|baby|kid/.test(name))key='toys';else if(/dry meat/.test(name))key='meat';else if(/food|grocery|meat|snack/.test(name))key='food';else if(/auto|car|bike|wheel|scooter/.test(name))key='auto';else if(/sport|fitness|gym/.test(name))key='sports';else if(/furniture/.test(name))key='furniture';else if(/book|stationery/.test(name))key='books';
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[key]}</svg>`;
}
function renderCategories() {
  const list = state.categories;
  document.querySelector('.category-rail').innerHTML = `<button class="rail-item ${activeCategory === 'All' ? 'active' : ''}" data-category="All"><span class="rail-icon">${categoryIcon('All')}</span><span class="rail-label">For You</span></button>${list.map((name) => `<button class="rail-item ${activeCategory === name ? 'active' : ''}" data-category="${esc(name)}"><span class="rail-icon">${categoryIcon(name)}</span><span class="rail-label">${esc(name)}</span></button>`).join('')}`;
  document.querySelectorAll('.rail-item').forEach((b) => b.addEventListener('click', () => setCategory(b.dataset.category, true)));
  let sideCategory = document.querySelector('.side-caption');
  let next = sideCategory;
  while (next.nextElementSibling && next.nextElementSibling.classList.contains('category-link')) next.nextElementSibling.remove();
  list.forEach((category) => {
    const button = document.createElement('button'); button.className = 'side-link category-link'; button.dataset.category = category; button.innerHTML = `<span>◈</span> ${esc(category)}`;
    button.addEventListener('click', () => { showPage('shop'); setCategory(category); }); sideCategory.after(button); sideCategory = button;
  });
  const select = document.querySelector('#productCategorySelect');
  const selected = select.value;
  select.innerHTML = list.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join('') + '<option value="Other">Other</option>';
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  renderFilterCategories();
}
function renderFilterCategories() {
  const categories = ['All', ...state.categories];
  document.querySelector('#filterCategories').innerHTML = categories.map((c) => `<button class="filter-chip ${activeCategory===c?'active':''}" data-filter-category="${esc(c)}">${esc(c)}</button>`).join('');
  document.querySelectorAll('[data-filter-category]').forEach((b) => b.addEventListener('click', () => setCategory(b.dataset.filterCategory)));
}
function renderBanner() {
  const banner = state.banners[bannerIndex % state.banners.length] || defaultBanners[0];
  document.querySelector('.hero-tag').textContent = banner.tag;
  document.querySelector('.hero-text h1').textContent = banner.title;
  document.querySelector('.hero-text p').textContent = banner.description;
  document.querySelector('#heroExplore').textContent = banner.button || 'Explore categories';
  const photo=document.querySelector('.hero-photo');
  if(banner.image&&/^https?:\/\//i.test(banner.image)){photo.src=banner.image;photo.hidden=false;document.querySelector('.hero-banner').classList.add('has-photo');photo.onerror=()=>{photo.hidden=true;document.querySelector('.hero-banner').classList.remove('has-photo')}}
  else{photo.removeAttribute('src');photo.hidden=true;document.querySelector('.hero-banner').classList.remove('has-photo')}
  const dots=document.querySelector('.banner-dots');
  dots.innerHTML=state.banners.map((slide,i)=>`<button type="button" class="${i===bannerIndex?'on':''}" aria-label="Show banner ${i+1}: ${esc(slide.tag)}" aria-current="${i===bannerIndex?'true':'false'}" data-banner-index="${i}"></button>`).join('');
  dots.querySelectorAll('[data-banner-index]').forEach((dot)=>dot.addEventListener('click',()=>changeBanner(Number(dot.dataset.bannerIndex)-bannerIndex)));
}
function renderSections() {
  const host = document.querySelector('#customSections');
  host.innerHTML = state.sections.map((section) => {
    if (section.type === 'categories') return `<section class="custom-home-section"><div class="custom-section-heading"><div><h2>${esc(section.title)}</h2><p>${esc(section.description || '')}</p></div></div><div class="custom-category-list">${state.categories.map((category) => `<button data-custom-category="${esc(category)}">${esc(category)} <span>›</span></button>`).join('')}</div></section>`;
    return `<section class="custom-home-section announcement-section"><div><span>◉</span><div><h2>${esc(section.title)}</h2><p>${esc(section.description || '')}</p></div></div></section>`;
  }).join('');
  host.querySelectorAll('[data-custom-category]').forEach((b) => b.addEventListener('click', () => setCategory(b.dataset.customCategory)));
}
function renderCategoryCampaigns() {
  const host=document.querySelector('#categoryCampaigns');
  const picks=state.categories.slice(0,3);
  if(!picks.length){host.innerHTML='';return}
  host.innerHTML=`<div class="campaign-heading"><div><span>DISCOVER YOUR WAY</span><h2>Explore by category</h2></div><button type="button" class="campaign-next" aria-label="Scroll categories" title="Scroll categories">→</button></div><div class="campaign-track">${picks.map((name,index)=>`<button class="campaign-card campaign-tone-${index+1}" data-campaign-category="${esc(name)}"><span class="campaign-card-copy"><small>BROWSE CATEGORY</small><strong>${esc(name)}</strong><em>Explore category <b>→</b></em></span><span class="campaign-art">${categoryIcon(name)}<i></i><i></i></span><span class="campaign-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>`;
  host.querySelectorAll('[data-campaign-category]').forEach((button)=>button.addEventListener('click',()=>{setCategory(button.dataset.campaignCategory,true)}));
  host.querySelector('.campaign-next').addEventListener('click',()=>host.querySelector('.campaign-track').scrollBy({left:320,behavior:'smooth'}));
}
function renderStore() {
  renderCategories(); renderBanner(); renderCategoryCampaigns(); renderSections(); renderProducts(); updateCartCount();
  document.querySelector('.brand > span:last-child').innerHTML = `${esc(state.settings.name)}<small>Explore <i>Plus</i></small>`;
  const announcement = state.settings.announcement;
  let bar = document.querySelector('#announcementBar');
  if (announcement && !bar) { bar = document.createElement('div'); bar.id = 'announcementBar'; bar.className = 'announcement-bar'; document.querySelector('.store-top').after(bar); }
  if (bar) { bar.textContent = announcement; bar.classList.toggle('hidden', !announcement); }
}
function setCategory(category, scroll = false) { activeCategory = category; renderFilterCategories(); document.querySelectorAll('.rail-item').forEach((b) => b.classList.toggle('active', b.dataset.category===category)); renderProducts(); document.querySelector(`.rail-item[data-category="${CSS.escape(category)}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}); if(scroll)document.querySelector('.catalog-section').scrollIntoView({behavior:'smooth',block:'start'}); }
function clearFilters() { activeCategory='All'; document.querySelector('#searchInput').value=''; document.querySelector('#priceRange').value=100000; document.querySelector('#priceValue').textContent='Any'; document.querySelector('#sortSelect').value='featured'; renderStore(); }
function addToCart(id) { const product=state.products.find((p)=>p.id===id); if(!product||product.stock<1)return toast('This item is currently out of stock'); state.cart[id]=(state.cart[id]||0)+1; saveState(); updateCartCount(); toast('Added to your cart'); }

function checkout(items=null) {
  const requested=items||Object.entries(state.cart).map(([id,quantity])=>({id,quantity}));
  const valid=requested.map((row)=>({...row,product:state.products.find((p)=>p.id===row.id)})).filter((row)=>row.product&&row.quantity>0&&row.product.stock>=row.quantity);
  if(!valid.length)return toast('Your cart is empty or the items are out of stock');
  const name=window.prompt('Customer name for this order:'); if(!name||!name.trim())return;
  const email=window.prompt('Customer email:'); if(!email||!email.trim())return;
  const cleanEmail=email.trim().toLowerCase(); let user=state.users.find((u)=>u.email.toLowerCase()===cleanEmail);
  if(!user){user={id:uid(),name:name.trim(),email:cleanEmail,joinedAt:Date.now()};state.users.unshift(user)}else user.name=name.trim();
  const lines=valid.map(({product,quantity})=>({productId:product.id,name:product.name,price:Number(product.price),quantity:Number(quantity)}));
  lines.forEach((line)=>{state.products.find((p)=>p.id===line.productId).stock-=line.quantity});
  const order={id:`OR-${Date.now().toString().slice(-8)}`,userId:user.id,customer:user.name,email:user.email,items:lines,total:lines.reduce((sum,line)=>sum+line.price*line.quantity,0),status:'Received',createdAt:Date.now()};
  state.orders.unshift(order); if(!items)state.cart={}; saveState(); renderStore(); toast(`Order ${order.id} received`);
}
function loginUser() { const name=window.prompt('Your name:');if(!name||!name.trim())return;const email=window.prompt('Your email:');if(!email||!email.trim())return;const clean=email.trim().toLowerCase();const user=state.users.find((u)=>u.email.toLowerCase()===clean);if(user)user.name=name.trim();else state.users.unshift({id:uid(),name:name.trim(),email:clean,joinedAt:Date.now()});saveState();renderAdmin();toast('Customer profile saved on this device'); }
function showPage(page) { const admin=page==='admin';document.querySelector('#shopView').classList.toggle('hidden',admin);document.querySelector('#adminView').classList.toggle('hidden',!admin);document.body.classList.toggle('admin-mode',admin);document.querySelectorAll('[data-page]').forEach((b)=>b.classList.toggle('selected',b.dataset.page===page));document.querySelectorAll('.mobile-nav-item').forEach((b)=>b.classList.toggle('active',b.dataset.page===page));if(admin)renderAdmin();else renderStore();closeSidebar();window.scrollTo({top:0,behavior:'smooth'}); }
function openSidebar(){document.querySelector('#sidebar').classList.add('open');document.querySelector('#scrim').classList.add('open')}
function closeSidebar(){document.querySelector('#sidebar').classList.remove('open');document.querySelector('#scrim').classList.remove('open')}

function openProductDialog(product=null) {
  editingProductId=product?.id||null; const form=document.querySelector('#productForm'); form.reset();
  form.dataset.mode='product';
  document.querySelector('#productDialogTitle').textContent=product?'Edit product':'Add a product';
  if(product)Object.entries(product).forEach(([key,value])=>{if(form.elements[key])form.elements[key].value=value});
  document.querySelector('#productDialog').showModal();
}
function removeProduct(id) { const product=state.products.find((p)=>p.id===id);if(!product||!window.confirm(`Remove “${product.name}” from the catalogue?`))return;state.products=state.products.filter((p)=>p.id!==id);delete state.cart[id];saveState();renderStore();renderAdmin();toast('Product removed'); }
function getAdminRows() {
  let rows=activeAdminTab==='products'?state.products:activeAdminTab==='orders'?state.orders:activeAdminTab==='users'?state.users:activeAdminTab==='categories'?state.categories.map((name)=>({name})):activeAdminTab==='sections'?state.sections:activeAdminTab==='banners'?state.banners:[];
  if(adminSearch)rows=rows.filter((row)=>JSON.stringify(row).toLowerCase().includes(adminSearch.toLowerCase()));
  if(adminFilter!=='all') {
    if(activeAdminTab==='products'&&adminFilter==='low-stock')rows=rows.filter((p)=>p.stock>0&&p.stock<=5);
    if(activeAdminTab==='products'&&adminFilter==='out-stock')rows=rows.filter((p)=>p.stock===0);
    if(activeAdminTab==='orders')rows=rows.filter((o)=>o.status===adminFilter);
  }
  return rows;
}
function adminToolbar(title,count,addLabel) {
  let filters='';
  if(activeAdminTab==='products')filters=`<select id="adminFilter"><option value="all">All stock</option><option value="low-stock">Low stock (1–5)</option><option value="out-stock">Out of stock</option>${state.categories.map((c)=>`<option value="category:${esc(c)}">${esc(c)}</option>`).join('')}</select>`;
  if(activeAdminTab==='orders')filters=`<select id="adminFilter"><option value="all">All statuses</option>${['Received','Processing','Shipped','Delivered','Cancelled'].map((s)=>`<option value="${s}">${s}</option>`).join('')}</select>`;
  if(activeAdminTab==='users')filters=`<select id="adminFilter"><option value="all">All customers</option><option value="with-orders">Has orders</option><option value="no-orders">No orders</option></select>`;
  const add=addLabel?`<button class="primary-button" id="adminAdd">＋ Add ${addLabel}</button>`:'';
  return `<div class="admin-toolbar"><div><h3>${title} <span class="toolbar-count">(${count})</span></h3><p>Changes save automatically in this browser</p></div><div class="admin-toolbar-actions">${filters}<input class="admin-search" id="adminSearch" type="search" placeholder="Search ${title.toLowerCase()}…" value="${esc(adminSearch)}">${add}</div></div>`;
}
function renderAdmin() {
  document.querySelector('#statProducts').textContent=state.products.length;document.querySelector('#statOrders').textContent=state.orders.length;document.querySelector('#statUsers').textContent=state.users.length;document.querySelector('#statSales').textContent=money(state.orders.filter((o)=>o.status!=='Cancelled').reduce((sum,o)=>sum+o.total,0));
  document.querySelector('#tabProductCount').textContent=state.products.length;document.querySelector('#tabOrderCount').textContent=state.orders.length;document.querySelector('#tabUserCount').textContent=state.users.length;
  document.querySelectorAll('.admin-tab').forEach((tab)=>tab.classList.toggle('active',tab.dataset.adminTab===activeAdminTab));
  const panel=document.querySelector('#adminPanel');
  if(activeAdminTab==='settings'){renderSettingsPanel(panel);return}
  const config={products:['Products',state.products.length,'product'],orders:['Orders',state.orders.length,''],users:['Customers',state.users.length,''],categories:['Categories',state.categories.length,'category'],sections:['Home sections',state.sections.length,'section'],banners:['Banner slides',state.banners.length,'banner']}[activeAdminTab];
  let rows=getAdminRows();
  if(activeAdminTab==='products'&&adminFilter.startsWith('category:'))rows=rows.filter((p)=>p.category===adminFilter.slice(9));
  if(activeAdminTab==='users'&&adminFilter==='with-orders')rows=rows.filter((u)=>state.orders.some((o)=>o.userId===u.id));
  if(activeAdminTab==='users'&&adminFilter==='no-orders')rows=rows.filter((u)=>!state.orders.some((o)=>o.userId===u.id));
  const [title,fullCount,addLabel]=config;
  const toolbar=adminToolbar(title,fullCount,addLabel||'');
  let table='';
  if(activeAdminTab==='products')table=`<table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${rows.map((p)=>`<tr><td><div class="table-product"><span class="table-thumb">◈</span><strong>${esc(p.name)}</strong></div></td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td><span class="${p.stock<=5?'stock-warn':''}">${p.stock}</span></td><td>${new Date(p.createdAt).toLocaleDateString()}</td><td><button class="edit-row" data-edit-product="${esc(p.id)}">Edit</button> <button class="delete-row" data-remove-product="${esc(p.id)}">Remove</button></td></tr>`).join('')}</tbody></table>`;
  if(activeAdminTab==='orders')table=`<table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>${rows.map((o)=>`<tr><td><strong>${esc(o.id)}</strong></td><td>${esc(o.customer)}<br><span class="sub-cell">${esc(o.email)}</span></td><td>${o.items.map((line)=>`${esc(line.name)} × ${line.quantity}`).join('<br>')}</td><td>${money(o.total)}</td><td><select class="status-select" data-order-status="${esc(o.id)}">${['Received','Processing','Shipped','Delivered','Cancelled'].map((s)=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}</select></td><td>${new Date(o.createdAt).toLocaleDateString()}</td></tr>`).join('')}</tbody></table>`;
  if(activeAdminTab==='users')table=`<table><thead><tr><th>Customer</th><th>Email</th><th>Orders</th><th>Total spent</th><th>Joined</th><th></th></tr></thead><tbody>${rows.map((u)=>{const orders=state.orders.filter((o)=>o.userId===u.id&&o.status!=='Cancelled');return `<tr><td><div class="table-product"><span class="table-thumb">♙</span><strong>${esc(u.name)}</strong></div></td><td>${esc(u.email)}</td><td>${orders.length}</td><td>${money(orders.reduce((sum,o)=>sum+o.total,0))}</td><td>${new Date(u.joinedAt).toLocaleDateString()}</td><td><button class="delete-row" data-remove-user="${esc(u.id)}">Remove</button></td></tr>`}).join('')}</tbody></table>`;
  if(activeAdminTab==='categories')table=`<table><thead><tr><th>Category name</th><th>Products</th><th>Storefront</th><th>Actions</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><strong>${esc(row.name)}</strong></td><td>${state.products.filter((p)=>p.category===row.name).length}</td><td><span class="status-pill">Visible</span></td><td><button class="edit-row" data-rename-category="${esc(row.name)}">Rename</button> <button class="delete-row" data-remove-category="${esc(row.name)}">Remove</button></td></tr>`).join('')}</tbody></table>`;
  if(activeAdminTab==='sections')table=`<table><thead><tr><th>Section</th><th>Layout</th><th>Storefront</th><th>Order</th><th>Actions</th></tr></thead><tbody>${rows.map((s,index)=>`<tr><td><strong>${esc(s.title)}</strong><br><span class="sub-cell">${esc(s.description||'')}</span></td><td>${s.type==='categories'?'Category shortcuts':'Announcement panel'}</td><td><span class="status-pill">Visible</span></td><td><button class="small-action" data-section-move="${index}:up" ${index===0?'disabled':''}>↑</button> <button class="small-action" data-section-move="${index}:down" ${index===rows.length-1?'disabled':''}>↓</button></td><td><button class="edit-row" data-edit-section="${esc(s.id)}">Edit</button> <button class="delete-row" data-remove-section="${esc(s.id)}">Remove</button></td></tr>`).join('')}</tbody></table>`;
  if(activeAdminTab==='banners')table=`<table><thead><tr><th>Slide</th><th>Heading</th><th>Supporting text</th><th>Actions</th></tr></thead><tbody>${rows.map((b,index)=>`<tr><td>${index+1}</td><td><strong>${esc(b.tag)}</strong><br>${esc(b.title).replaceAll('\n','<br>')}</td><td>${esc(b.description)}</td><td><button class="edit-row" data-edit-banner="${esc(b.id)}">Edit</button> <button class="delete-row" data-remove-banner="${esc(b.id)}">Remove</button></td></tr>`).join('')}</tbody></table>`;
  const emptyTitles={products:'No products yet',orders:'No orders received',users:'No customers yet',categories:'No categories',sections:'No homepage sections',banners:'No banner slides'};
  const emptyCopy={products:'Add products, images, prices and inventory without editing code.',orders:'Orders placed from the storefront show up here.',users:'Customer records appear when a customer profile or order is created.',categories:'Create categories to organize products and the storefront menu.',sections:'Build new homepage areas from the admin panel.',banners:'Create rotating hero slides for the storefront.'};
  const empty=rows.length?`<div class="admin-table-wrap">${table}</div>`:`<div class="admin-empty"><span>◈</span><strong>${emptyTitles[activeAdminTab]}</strong><p>${emptyCopy[activeAdminTab]}</p></div>`;
  panel.innerHTML=toolbar+empty;
  const filterControl=panel.querySelector('#adminFilter');if(filterControl&&[...filterControl.options].some((option)=>option.value===adminFilter))filterControl.value=adminFilter;
  panel.querySelector('#adminSearch')?.addEventListener('input',(event)=>{adminSearch=event.target.value;const at=event.target.selectionStart;renderAdmin();const input=document.querySelector('#adminSearch');input.focus();input.setSelectionRange(at,at)});
  panel.querySelector('#adminFilter')?.addEventListener('change',(event)=>{adminFilter=event.target.value;renderAdmin()});
  panel.querySelector('#adminAdd')?.addEventListener('click',()=>{if(activeAdminTab==='products')openProductDialog();else openEntityDialog(activeAdminTab)});
  panel.querySelectorAll('[data-edit-product]').forEach((b)=>b.addEventListener('click',()=>openProductDialog(state.products.find((p)=>p.id===b.dataset.editProduct))));
  panel.querySelectorAll('[data-remove-product]').forEach((b)=>b.addEventListener('click',()=>removeProduct(b.dataset.removeProduct)));
  panel.querySelectorAll('[data-order-status]').forEach((select)=>select.addEventListener('change',()=>{const order=state.orders.find((o)=>o.id===select.dataset.orderStatus);if(order){order.status=select.value;saveState();renderAdmin();toast('Order status updated')}}));
  panel.querySelectorAll('[data-remove-user]').forEach((b)=>b.addEventListener('click',()=>{if(!confirm('Remove this customer profile? Order records will remain.'))return;state.users=state.users.filter((u)=>u.id!==b.dataset.removeUser);saveState();renderAdmin();toast('Customer removed')}));
  panel.querySelectorAll('[data-rename-category]').forEach((b)=>b.addEventListener('click',()=>openEntityDialog('categories',b.dataset.renameCategory)));
  panel.querySelectorAll('[data-remove-category]').forEach((b)=>b.addEventListener('click',()=>removeCategory(b.dataset.removeCategory)));
  panel.querySelectorAll('[data-edit-section]').forEach((b)=>b.addEventListener('click',()=>openEntityDialog('sections',b.dataset.editSection)));
  panel.querySelectorAll('[data-remove-section]').forEach((b)=>b.addEventListener('click',()=>{state.sections=state.sections.filter((s)=>s.id!==b.dataset.removeSection);saveState();renderAdmin();renderSections();toast('Homepage section removed')}));
  panel.querySelectorAll('[data-section-move]').forEach((b)=>b.addEventListener('click',()=>moveSection(b.dataset.sectionMove)));
  panel.querySelectorAll('[data-edit-banner]').forEach((b)=>b.addEventListener('click',()=>openEntityDialog('banners',b.dataset.editBanner)));
  panel.querySelectorAll('[data-remove-banner]').forEach((b)=>b.addEventListener('click',()=>{if(state.banners.length===1)return toast('Keep at least one banner slide');state.banners=state.banners.filter((s)=>s.id!==b.dataset.removeBanner);bannerIndex=0;saveState();renderAdmin();renderBanner();toast('Banner slide removed')}));
}
function removeCategory(name) {
  if(state.products.some((p)=>p.category===name))return toast('Move or remove this category’s products first');
  if(!confirm(`Remove the “${name}” category?`))return;
  state.categories=state.categories.filter((c)=>c!==name);if(activeCategory===name)activeCategory='All';saveState();renderStore();renderAdmin();toast('Category removed');
}
function moveSection(value) { const [raw,direction]=value.split(':');const index=Number(raw);const target=direction==='up'?index-1:index+1;if(target<0||target>=state.sections.length)return;[state.sections[index],state.sections[target]]=[state.sections[target],state.sections[index]];saveState();renderSections();renderAdmin(); }
function renderSettingsPanel(panel) {
  const s=state.settings;
  panel.innerHTML=`<form id="settingsForm" class="settings-form"><div class="admin-toolbar"><div><h3>Store settings</h3><p>Update your storefront identity and customer-facing details.</p></div><button class="primary-button">Save settings</button></div><div class="settings-grid"><label>Store name<input name="name" required maxlength="35" value="${esc(s.name)}"><small>Shown in the top navigation.</small></label><label>Tagline<input name="tagline" maxlength="100" value="${esc(s.tagline)}"><small>A short description for your store.</small></label><label>Support email<input name="supportEmail" type="email" value="${esc(s.supportEmail)}" placeholder="help@example.com"><small>Contact address shown to customers.</small></label><label>Currency symbol<select name="currency">${['₹','$','€','£','¥'].map((c)=>`<option ${s.currency===c?'selected':''}>${c}</option>`).join('')}</select><small>Used for product prices and order totals.</small></label><label class="wide-setting">Announcement bar<input name="announcement" maxlength="120" value="${esc(s.announcement)}" placeholder="Optional message shown above the shop"><small>Leave empty to hide the announcement.</small></label></div><div class="settings-note">This browser stores the catalogue and activity locally. A connected backend is needed to share changes across devices or accept live orders.</div><section class="data-tools"><h3>Store data</h3><p>Download a backup or export lists for your records.</p><div><button type="button" class="secondary-button" id="exportBackup">Download full backup</button><button type="button" class="secondary-button" id="exportProducts">Export products CSV</button><button type="button" class="secondary-button" id="exportOrders">Export orders CSV</button><button type="button" class="secondary-button" id="chooseBackup">Restore backup</button><input id="backupFile" type="file" accept="application/json,.json" hidden></div></section><button type="button" class="secondary-button reset-data" id="resetStore">Reset browser store data</button></form>`;
  panel.querySelector('#settingsForm').addEventListener('submit',(event)=>{event.preventDefault();const data=new FormData(event.currentTarget);state.settings={...state.settings,name:String(data.get('name')).trim(),tagline:String(data.get('tagline')||'').trim(),supportEmail:String(data.get('supportEmail')||'').trim(),currency:data.get('currency'),announcement:String(data.get('announcement')||'').trim()};saveState();renderStore();renderAdmin();toast('Store settings saved')});
  panel.querySelector('#resetStore').addEventListener('click',()=>{if(!confirm('This permanently clears all products, customers, orders, cart, categories, sections and settings saved in this browser. Continue?'))return;localStorage.removeItem(STORAGE_KEY);state=JSON.parse(JSON.stringify(defaults));adminSearch='';adminFilter='all';activeCategory='All';saveState();renderStore();renderAdmin();toast('Browser store data reset')});
  panel.querySelector('#exportBackup').addEventListener('click',()=>downloadFile('orbit-store-backup.json',JSON.stringify(state,null,2),'application/json'));
  panel.querySelector('#exportProducts').addEventListener('click',()=>downloadCSV('orbit-products.csv',['Name','Category','Price','Stock','Description'],state.products.map((p)=>[p.name,p.category,p.price,p.stock,p.description||''])));
  panel.querySelector('#exportOrders').addEventListener('click',()=>downloadCSV('orbit-orders.csv',['Order ID','Customer','Email','Items','Total','Status','Date'],state.orders.map((o)=>[o.id,o.customer,o.email,o.items.map((line)=>`${line.name} x ${line.quantity}`).join('; '),o.total,o.status,new Date(o.createdAt).toISOString()])));
  panel.querySelector('#chooseBackup').addEventListener('click',()=>panel.querySelector('#backupFile').click());
  panel.querySelector('#backupFile').addEventListener('change',async(event)=>{const file=event.target.files[0];if(!file)return;try{const restored=JSON.parse(await file.text());if(!Array.isArray(restored.products)||!Array.isArray(restored.categories)||!Array.isArray(restored.orders)||!Array.isArray(restored.users)||!restored.settings)throw new Error('Invalid backup');if(!confirm('Replace the current browser store data with this backup?'))return;state={...defaults,...restored,cart:restored.cart||{},sections:restored.sections||[],banners:restored.banners?.length?restored.banners:defaultBanners};saveState();activeCategory='All';adminFilter='all';adminSearch='';renderStore();renderAdmin();toast('Backup restored')}catch{toast('That file is not a valid Orbit store backup')}finally{event.target.value=''}});
}
function downloadFile(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function downloadCSV(name,headers,rows){const quote=(value)=>`"${String(value??'').replaceAll('"','""')}"`;downloadFile(name,[headers,...rows].map((row)=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8')}
function openEntityDialog(type,id=null) {
  const existing=type==='categories'?id:type==='sections'?state.sections.find((s)=>s.id===id):state.banners.find((b)=>b.id===id);
  const isEdit=Boolean(existing);const title=type==='categories'?'category':type==='sections'?'homepage section':'banner slide';
  const initial=type==='categories'?{name:id||''}:existing||{};
  let fields='';
  if(type==='categories')fields=`<label>Category name<input name="name" required maxlength="35" value="${esc(initial.name)}" placeholder="e.g. Garden"></label>`;
  if(type==='sections')fields=`<label>Section title<input name="title" required maxlength="55" value="${esc(initial.title||'')}" placeholder="e.g. Shop by mood"></label><label>Supporting text<input name="description" maxlength="120" value="${esc(initial.description||'')}" placeholder="Optional short description"></label><label>Section layout<select name="type"><option value="categories" ${initial.type==='categories'?'selected':''}>Category shortcuts</option><option value="announcement" ${initial.type==='announcement'?'selected':''}>Announcement panel</option></select><small>Category shortcuts link to your live categories. Announcement panels display your text.</small></label>`;
  if(type==='banners')fields=`<label>Small label<input name="tag" required maxlength="45" value="${esc(initial.tag||'')}" placeholder="A NEW WAY TO DISCOVER"></label><label>Headline<input name="title" required maxlength="70" value="${esc(initial.title||'')}" placeholder="Your headline (use a new line for a second line)"></label><label>Supporting text<input name="description" maxlength="120" value="${esc(initial.description||'')}"></label><label>Button label<input name="button" maxlength="25" value="${esc(initial.button||'Explore categories')}"></label><label>Banner image URL <small>optional, use an image you own</small><input name="image" type="url" value="${esc(initial.image||'')}" placeholder="https://example.com/banner.jpg"></label>`;
  const dialog=document.querySelector('#entityDialog');const form=document.querySelector('#entityForm');form.innerHTML=`<div class="dialog-head"><div><span class="crumb">STORE BUILDER</span><h2>${isEdit?'Edit':'Add'} ${title}</h2></div><button type="button" class="dialog-close" id="closeEntityDialog">×</button></div>${fields}<div class="form-actions"><button type="button" class="secondary-button" id="cancelEntityDialog">Cancel</button><button class="primary-button" type="submit">Save ${title}</button></div>`;
  form.onsubmit=(event)=>{event.preventDefault();const data=new FormData(form);
    if(type==='categories'){const name=String(data.get('name')).trim();if(state.categories.some((c)=>c.toLowerCase()===name.toLowerCase()&&c!==id))return toast('That category already exists');if(isEdit){state.categories=state.categories.map((c)=>c===id?name:c);state.products.forEach((p)=>{if(p.category===id)p.category=name});if(activeCategory===id)activeCategory=name}else state.categories.push(name)}
    if(type==='sections'){const entity={id:existing?.id||uid(),title:String(data.get('title')).trim(),description:String(data.get('description')||'').trim(),type:data.get('type')};if(isEdit)state.sections=state.sections.map((s)=>s.id===id?entity:s);else state.sections.push(entity)}
    if(type==='banners'){const entity={id:existing?.id||uid(),tag:String(data.get('tag')).trim(),title:String(data.get('title')).trim(),description:String(data.get('description')||'').trim(),button:String(data.get('button')||'Explore categories').trim(),image:String(data.get('image')||'').trim()};if(isEdit)state.banners=state.banners.map((b)=>b.id===id?entity:b);else state.banners.push(entity)}
    saveState();dialog.close();renderStore();renderAdmin();toast(`${title[0].toUpperCase()+title.slice(1)} saved`);
  };
  document.querySelector('#closeEntityDialog').onclick=()=>dialog.close();document.querySelector('#cancelEntityDialog').onclick=()=>dialog.close();dialog.showModal();
}

document.querySelector('#searchForm').addEventListener('submit',(event)=>{event.preventDefault();showPage('shop');renderProducts();document.querySelector('.catalog-section').scrollIntoView({behavior:'smooth'})});
document.querySelector('#searchInput').addEventListener('input',renderProducts);document.querySelector('#sortSelect').addEventListener('change',renderProducts);
document.querySelector('#filterToggle').addEventListener('click',()=>document.querySelector('#filterPanel').classList.toggle('open'));
document.querySelector('#priceRange').addEventListener('input',(event)=>{const value=Number(event.target.value);document.querySelector('#priceValue').textContent=value>=100000?'Any':money(value);renderProducts()});document.querySelector('#clearFilters').addEventListener('click',clearFilters);
document.querySelectorAll('.admin-tab').forEach((b)=>b.addEventListener('click',()=>{activeAdminTab=b.dataset.adminTab;adminSearch='';adminFilter='all';renderAdmin()}));
document.querySelectorAll('[data-page]').forEach((b)=>b.addEventListener('click',()=>showPage(b.dataset.page)));
document.querySelector('#menuButton').addEventListener('click',openSidebar);document.querySelector('#closeMenu').addEventListener('click',closeSidebar);document.querySelector('#scrim').addEventListener('click',closeSidebar);
document.querySelector('#adminTop').addEventListener('click',()=>showPage('admin'));document.querySelector('#homeBrand').addEventListener('click',(event)=>{event.preventDefault();showPage('shop');clearFilters()});document.querySelector('#loginButton').addEventListener('click',loginUser);
document.querySelector('#cartButton').addEventListener('click',()=>checkout());document.querySelector('#mobileCart').addEventListener('click',()=>checkout());document.querySelector('#mobileCategories').addEventListener('click',openSidebar);
document.querySelector('#heroExplore').addEventListener('click',()=>document.querySelector('.category-rail').scrollIntoView({behavior:'smooth',block:'center'}));document.querySelector('#addProductTop').addEventListener('click',()=>openProductDialog());
document.querySelector('#closeDialog').addEventListener('click',()=>document.querySelector('#productDialog').close());document.querySelector('#cancelDialog').addEventListener('click',()=>document.querySelector('#productDialog').close());
document.querySelector('#productForm').addEventListener('submit',(event)=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form);const product={id:editingProductId||uid(),name:String(data.get('name')).trim(),category:data.get('category'),price:Number(data.get('price')),stock:Number(data.get('stock')),image:String(data.get('image')||'').trim(),description:String(data.get('description')||'').trim(),createdAt:Date.now()};if(!product.name||product.price<=0||product.stock<0)return toast('Check the product details and try again');if(editingProductId){const old=state.products.findIndex((p)=>p.id===editingProductId);if(old>=0)state.products[old]=product}else state.products.unshift(product);saveState();document.querySelector('#productDialog').close();renderStore();renderAdmin();toast(editingProductId?'Product updated':'Product added to catalogue');editingProductId=null;});
document.querySelector('.banner-arrow.left').addEventListener('click',()=>changeBanner(-1));document.querySelector('.banner-arrow.right').addEventListener('click',()=>changeBanner(1));
function changeBanner(step){
  if(state.banners.length<2)return;
  const hero=document.querySelector('.hero-banner');
  bannerIndex=(bannerIndex+step+state.banners.length)%state.banners.length;
  hero.classList.add('switching');clearTimeout(bannerTransitionTimer);
  bannerTransitionTimer=setTimeout(()=>{renderBanner();requestAnimationFrame(()=>hero.classList.remove('switching'))},150);
}
let swipeStart=null;
const heroBanner=document.querySelector('.hero-banner');
heroBanner.addEventListener('pointerdown',(event)=>{if(event.target.closest('button'))return;swipeStart={x:event.clientX,y:event.clientY};});
heroBanner.addEventListener('pointerup',(event)=>{if(!swipeStart)return;const dx=event.clientX-swipeStart.x,dy=event.clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.2)changeBanner(dx<0?1:-1)});
heroBanner.addEventListener('pointercancel',()=>{swipeStart=null});
heroBanner.addEventListener('pointermove',(event)=>{if(event.pointerType==='mouse'&&window.matchMedia('(prefers-reduced-motion: no-preference)').matches){const rect=heroBanner.getBoundingClientRect();heroBanner.style.setProperty('--pointer-shift-x',`${(.5-(event.clientX-rect.left)/rect.width)*10}px`);heroBanner.style.setProperty('--pointer-shift-y',`${(.5-(event.clientY-rect.top)/rect.height)*8}px`)}});
heroBanner.addEventListener('pointerleave',()=>{heroBanner.style.setProperty('--pointer-shift-x','0px');heroBanner.style.setProperty('--pointer-shift-y','0px')});
heroBanner.addEventListener('keydown',(event)=>{if(event.key==='ArrowLeft'){event.preventDefault();changeBanner(-1)}if(event.key==='ArrowRight'){event.preventDefault();changeBanner(1)}});
document.querySelector('.category-rail').addEventListener('wheel',(event)=>{const rail=event.currentTarget;if(Math.abs(event.deltaY)>Math.abs(event.deltaX)&&rail.scrollWidth>rail.clientWidth){rail.scrollLeft+=event.deltaY;event.preventDefault()}},{passive:false});
setInterval(()=>{if(!document.hidden&&state.banners.length>1&&!heroBanner.matches(':hover')&&!heroBanner.contains(document.activeElement))changeBanner(1)},6500);
renderStore();
