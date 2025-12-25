// Lightweight UI interactions: image modal zoom
(function(){
  let modal, img;
  function ensureModal(){
    if(modal) return;
    modal = document.createElement('div');
    modal.className = 'img-modal hidden';
    modal.innerHTML = '<div class="img-modal-backdrop"></div><img class="img-modal-img" alt="Preview" />';
    document.body.appendChild(modal);
    img = modal.querySelector('.img-modal-img');
    modal.addEventListener('click', hide);
    document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') hide(); });
  }
  function show(src, alt){ ensureModal(); img.src = src; img.alt = alt || 'Preview'; modal.classList.remove('hidden'); }
  function hide(){ if(modal) modal.classList.add('hidden'); }

  document.addEventListener('DOMContentLoaded', function(){
    ensureModal();
    document.querySelectorAll('.product .thumb').forEach(el => {
      el.style.cursor = 'zoom-in';
      el.addEventListener('click', ()=>{
        const full = el.getAttribute('data-full') || el.src;
        show(full, el.alt);
      });
    });
  });
})();