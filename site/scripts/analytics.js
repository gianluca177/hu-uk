(function(){
  const send = (name, props={}) => {
    if (window.plausible) plausible(name, { props });
    else console.log('[metric]', name, props);
  };
  document.addEventListener('click', e=>{
    const a = e.target.closest('a'); if(!a) return;
    if (a.dataset.track) send('cta_click', { id: a.dataset.track });
    if (a.host && a.host !== location.host) send('outbound_click', { href: a.href });
  });
  let fired25=false,fired50=false,fired75=false;
  document.addEventListener('scroll',()=>{
    const h=document.documentElement, p=(h.scrollTop/(h.scrollHeight-h.clientHeight))*100;
    if(!fired25 && p>25){fired25=true; send('scroll_25');}
    if(!fired50 && p>50){fired50=true; send('scroll_50');}
    if(!fired75 && p>75){fired75=true; send('scroll_75');}
  },{passive:true});
})();
