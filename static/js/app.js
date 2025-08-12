// small helpers used across pages (confetti + speech + postScore)
window.app = (function(){
  function postScore(payload){
    fetch('/api/score', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    }).then(r=>r.json()).then(res=>{
      console.log('saved score', res);
    }).catch(e=>console.warn('score save failed', e));
  }

  function speakText(text){
    if(!('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch(e){
      console.warn('speech failed', e);
    }
  }

  function celebrate(options){
    // options may include particleCount, spread, origin
    try {
      confetti(Object.assign({
        particleCount: 80,
        spread: 70,
        scalar: 1.1,
        origin: { y: 0.6 }
      }, options || {}));
    } catch(e){
      console.warn('confetti not available', e);
    }
  }

  return { postScore, speakText, celebrate };
})();
