// Simple shop script: cart + WhatsApp ordering
(function(){
  const STORAGE_KEY = 'minaatocs_cart_v1';
  const WHATSAPP_NUMBER = '4915739852756'; // TODO: set your number, no leading +
  const EMAIL_ADDRESS = 'minatoenterprisecom@gmail.com';
  const API_BASE = (window.API_BASE_URL || '');

  function getCart(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
  }
  function saveCart(cart){ localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); }
  function formatCurrency(amount){ return 'GHS ' + Number(amount).toFixed(2); }
  function updateCartCount(){
    const totalQty = getCart().reduce((s,i)=>s + (i.qty||1), 0);
    document.querySelectorAll('.cart-count').forEach(el=>{ el.textContent = totalQty; });
  }
  function addToCart(product){
    const cart = getCart();
    const existing = cart.find(i => i.id === product.id);
    if(existing){ existing.qty += 1; }
    else { cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 }); }
    saveCart(cart);
    updateCartCount();
    alert(product.name + ' added to cart');
  }
  function removeFromCart(id){
    const cart = getCart().filter(i => i.id !== id);
    saveCart(cart); renderCart(); updateCartCount();
  }
  function changeQty(id, delta){
    const cart = getCart();
    const item = cart.find(i => i.id === id);
    if(!item) return;
    item.qty += delta;
    if(item.qty <= 0){
      const filtered = cart.filter(i => i.id !== id);
      saveCart(filtered);
    } else {
      saveCart(cart);
    }
    renderCart(); updateCartCount();
  }
  function clearCart(){ saveCart([]); renderCart(); updateCartCount(); }

  function renderCart(){
    const container = document.getElementById('cart-items');
    const summary = document.getElementById('cart-summary');
    if(!container || !summary) return;
    const cart = getCart();
    if(cart.length === 0){
      container.innerHTML = '<p>Your cart is empty.</p>';
      summary.innerHTML = '';
      return;
    }
    let html = '';
    let total = 0;
    cart.forEach(item => {
      const line = item.price * item.qty;
      total += line;
      html += `
        <div class="card">
          <h4>${item.name}</h4>
          <p>${formatCurrency(item.price)} × ${item.qty} = <strong>${formatCurrency(line)}</strong></p>
          <div class="actions">
            <button class="btn" data-act="dec" data-id="${item.id}">-</button>
            <button class="btn" data-act="inc" data-id="${item.id}">+</button>
            <button class="btn" data-act="rm" data-id="${item.id}">Remove</button>
          </div>
        </div>`;
    });
    container.innerHTML = html;
    summary.innerHTML = `<p><strong>Total: ${formatCurrency(total)}</strong></p>`;

    container.querySelectorAll('button[data-act]').forEach(btn => {
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-act');
      btn.addEventListener('click', () => {
        if(act === 'inc') changeQty(id, +1);
        else if(act === 'dec') changeQty(id, -1);
        else if(act === 'rm') removeFromCart(id);
      });
    });

    const clearBtn = document.getElementById('clear-cart');
    if(clearBtn) clearBtn.onclick = clearCart;
  }

  function renderCheckout(){
    const container = document.getElementById('checkout-summary');
    const form = document.getElementById('checkout-form');
    const emailBtn = document.getElementById('email-order-btn');
    const payBtn = document.getElementById('pay-card-btn');
    if(!container || !form) return;
    const cart = getCart();
    if(cart.length === 0){
      container.innerHTML = '<p>Your cart is empty.</p>';
      return;
    }
    let total = 0;
    let lines = cart.map(i => {
      const line = i.price * i.qty; total += line;
      return `${i.name} x ${i.qty} = ${formatCurrency(line)}`;
    });
    container.innerHTML = `
      <h3>Order Summary</h3>
      <ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>
      <p><strong>Total: ${formatCurrency(total)}</strong></p>`;

    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const name = document.getElementById('cust-name').value.trim();
      const phone = document.getElementById('cust-phone').value.trim();
      const addr = document.getElementById('cust-address').value.trim();
      const opt = document.getElementById('delivery-option').value;
      const notes = document.getElementById('cust-notes').value.trim();

      const cartText = cart.map(i => `${i.name} x ${i.qty}`).join(', ');
      const msg = `Order from ${name}\nPhone: ${phone}\nOption: ${opt}\nAddress: ${addr}\nItems: ${cartText}\nTotal: ${formatCurrency(total)}\nNotes: ${notes}`;
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    });

    if(emailBtn){
      emailBtn.addEventListener('click', ()=>{
        const name = document.getElementById('cust-name').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        const addr = document.getElementById('cust-address').value.trim();
        const opt = document.getElementById('delivery-option').value;
        const notes = document.getElementById('cust-notes').value.trim();

        const cartText = cart.map(i => `${i.name} x ${i.qty}`).join(', ');
        const subject = `Order - ${name || 'Minaato Customer'}`;
        const body = `Order from ${name}\nPhone: ${phone}\nOption: ${opt}\nAddress: ${addr}\nItems: ${cartText}\nTotal: ${formatCurrency(total)}\nNotes: ${notes}`;
        const mailto = `mailto:${EMAIL_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
      });
    }

    if(payBtn){
      payBtn.addEventListener('click', async ()=>{
        const name = document.getElementById('cust-name').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        const addr = document.getElementById('cust-address').value.trim();
        const opt = document.getElementById('delivery-option').value;
        const notes = document.getElementById('cust-notes').value.trim();
        const email = `${phone}@minaato.local`; // placeholder email based on phone

        try {
          const orderRes = await fetch(API_BASE + '/api/orders', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, address: addr, deliveryOption: opt, items: cart, total })
          });
          if(!orderRes.ok) throw new Error('Create order failed');
          const { order } = await orderRes.json();

          const payRes = await fetch(API_BASE + '/api/paystack/initialize', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, amountGHS: total, orderId: order.id })
          });
          if(!payRes.ok) throw new Error('Payment init failed');
          const data = await payRes.json();
          if(data.authorization_url){ window.location.href = data.authorization_url; }
          else { alert('Could not start payment.'); }
        } catch (err){
          alert('Backend not available yet. Please use WhatsApp or Email.');
          console.error(err);
        }
      });
    }
  }

  function bindProductButtons(){
    document.querySelectorAll('.product').forEach(el => {
      const id = el.getAttribute('data-id');
      const name = el.getAttribute('data-name');
      const price = Number(el.getAttribute('data-price'));
      const addBtn = el.querySelector('.add-to-cart');
      const buyBtn = el.querySelector('.buy-now');
      const waBtn = el.querySelector('.order-whatsapp');
      const emailBtn = el.querySelector('.order-email');
      if(addBtn){ addBtn.addEventListener('click', ()=> addToCart({id, name, price})); }
      if(buyBtn){ buyBtn.addEventListener('click', ()=>{ addToCart({id, name, price}); window.location.href = 'checkout.html'; }); }
      if(waBtn){ waBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        const msg = `Hello, I want to order ${name} (GHS ${price.toFixed(2)}).`;
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
      }); }
      if(emailBtn){ emailBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        const subject = `Product Inquiry: ${name}`;
        const body = `Hello, I'm interested in ${name} (GHS ${price.toFixed(2)}).`;
        const mailto = `mailto:${EMAIL_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
      }); }
    });

    document.querySelectorAll('[data-whatsapp-order]').forEach(btn => {
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        const topic = btn.getAttribute('data-whatsapp-order');
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello! ' + topic)}`;
        window.open(url, '_blank');
      });
    });

    document.querySelectorAll('[data-email-cta]').forEach(btn => {
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        const topic = btn.getAttribute('data-email-cta') || 'Inquiry';
        const subject = `Minaato - ${topic}`;
        const body = `Hello, I'd like to ask about: ${topic}.`;
        const mailto = `mailto:${EMAIL_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    updateCartCount();
    bindProductButtons();
    renderCart();
    renderCheckout();
  });
})();