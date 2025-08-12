// static/js/math-game.js
// Math quiz with Teachable Machine gesture support (classes "1","2","3","4")
// Detection: slowed frequency + stability + cooldown after selection

(function(){
  // CONFIG
  const MODEL_BASE = '/static/models/math_gestures'; // folder with model.json & metadata.json
  const CONF_THRESH = 0.75;           // require >= 75% confidence
  const STABILITY_REQUIRED = 3;       // number of consistent detections before accept
  const DETECTION_INTERVAL_MS = 700;  // check every 700ms
  const COOLDOWN_MS = 2000;           // 2s cooldown after each accepted gesture

  // DOM
  const questionEl = document.getElementById('question');
  const optionsContainer = document.getElementById('optionsContainer');
  const feedbackBar = document.getElementById('feedbackBar');
  const gestureToggle = document.getElementById('gestureToggle');
  const cameraWrap = document.getElementById('cameraWrap');
  const webcamHolder = document.getElementById('webcamHolder');

  // state
  let currentQ = null;
  let tmModel = null;
  let tmWebcam = null;
  let detectIntervalId = null;
  let stableLabel = null;
  let stableCount = 0;
  let inCooldown = false;

  // small sound generator
  const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
  function playTone(freq, time=0.35){
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + time);
    o.start();
    o.stop(audioCtx.currentTime + time + 0.02);
  }

  // utils
  function shuffle(arr){ return arr.sort(()=> Math.random() - 0.5); }

  // create a random math question
  function makeQuestion(){
    const ops = ['+','-','×','÷'];
    const op = ops[Math.floor(Math.random() * ops.length)];

    let a = Math.floor(Math.random() * 12) + 1; // 1..12
    let b = Math.floor(Math.random() * 12) + 1;

    // ensure integer division
    if (op === '÷') {
      a = a * b; // so a ÷ b is integer
    }

    let correct;
    switch(op){
      case '+': correct = a + b; break;
      case '-': correct = a - b; break;
      case '×': correct = a * b; break;
      case '÷': correct = a / b; break;
    }

    // plausible wrong answers
    const wrongs = new Set();
    while (wrongs.size < 3){
      // generate candidate near correct
      let delta = Math.floor(Math.random()*9) - 4; // -4..+4
      if (delta === 0) delta = 5;
      let cand = correct + delta;
      if (typeof correct === 'number' && !isNaN(cand) && cand >= 0 && cand !== correct) {
        // for division (just in case), round nicely
        if (op === '÷') cand = Math.round((cand + Number.EPSILON) * 100) / 100;
        wrongs.add(cand);
      }
    }

    const options = shuffle([ ...wrongs, correct ]);
    return { text: `${a} ${op} ${b} = ?`, options, correct };
  }

  // render question
  function renderQuestion(q){
    currentQ = q;
    questionEl.textContent = q.text;
    optionsContainer.innerHTML = '';
    const colorClasses = ['opt-1','opt-2','opt-3','opt-4'];
    q.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = `option-btn ${colorClasses[idx]}`;
      btn.textContent = String(opt);
      btn.dataset.idx = idx;
      btn.addEventListener('click', () => onSelect(idx));
      optionsContainer.appendChild(btn);
    });
    feedbackBar.textContent = '';
  }

  function showCorrect(){
    feedbackBar.textContent = '✅ Correct! Great job!';
    feedbackBar.style.color = '#0b8a44';
    playTone(880, 0.2);
    try { confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } }); } catch(e){}
  }
  function showWrong(correct){
    feedbackBar.textContent = `❌ Oops — correct answer: ${correct}`;
    feedbackBar.style.color = '#b91c1c';
    playTone(220, 0.18);
  }

  // handle selection (clicked or gesture)
  function onSelect(idx){
    const chosen = currentQ.options[idx];
    if (chosen === currentQ.correct){
      // flash button
      const btn = optionsContainer.querySelectorAll('.option-btn')[idx];
      btn.classList.add('selected-temp');
      setTimeout(()=>btn.classList.remove('selected-temp'), 700);
      showCorrect();
    } else {
      const btn = optionsContainer.querySelectorAll('.option-btn')[idx];
      btn.classList.add('option-wrong');
      setTimeout(()=>btn.classList.remove('option-wrong'), 700);
      showWrong(currentQ.correct);
    }
    // move to next after short delay
    setTimeout(() => startRound(), 900);
  }

  // start next round
  function startRound(){
    const q = makeQuestion();
    renderQuestion(q);
  }

  // TM model loading
  async function loadTMModel(){
    try {
      feedbackBar.textContent = 'Loading gesture model…';
      // tmImage library provides tmImage.load
      const modelURL = `${MODEL_BASE}/model.json`;
      const metadataURL = `${MODEL_BASE}/metadata.json`;
      tmModel = await tmImage.load(modelURL, metadataURL);
      feedbackBar.textContent = '';
      return true;
    } catch(err){
      console.error('Model load failed', err);
      feedbackBar.textContent = '⚠️ Gesture model not found. Put model.json & metadata.json in static/models/math_gestures/';
      return false;
    }
  }

  // start webcam using tmImage.Webcam helper
  async function startWebcam(){
    try {
      tmWebcam = new tmImage.Webcam(360, 270, true);
      await tmWebcam.setup({ facingMode: 'user' });
      await tmWebcam.play();
      webcamHolder.innerHTML = '';
      webcamHolder.appendChild(tmWebcam.canvas);
      cameraWrap.style.display = 'block';
      return true;
    } catch(err){
      console.warn('webcam setup failed', err);
      feedbackBar.textContent = '⚠️ Camera access required for gestures.';
      return false;
    }
  }

  // stop webcam
  function stopWebcam(){
    try {
      if (tmWebcam) tmWebcam.stop();
    } catch(e){}
    tmWebcam = null;
    cameraWrap.style.display = 'none';
    webcamHolder.innerHTML = '';
  }

  // prediction tick (called at DETECTION_INTERVAL_MS)
  async function detectOnce(){
    if (!tmModel || !tmWebcam || inCooldown) return;
    try {
      tmWebcam.update();
      const preds = await tmModel.predict(tmWebcam.canvas); // array of {className, probability}
      // find top prediction
      let top = preds[0];
      for (let p of preds) if (p.probability > top.probability) top = p;
      if (top.probability >= CONF_THRESH) {
        // require stable label
        const label = String(top.className).trim(); // expecting "1","2","3","4"
        if (stableLabel === label) stableCount++; else { stableLabel = label; stableCount = 1; }
        if (stableCount >= STABILITY_REQUIRED) {
          // trigger selection
          const chosenIndex = parseInt(label, 10) - 1; // label "1" => index 0
          if (!Number.isNaN(chosenIndex) && chosenIndex >= 0 && chosenIndex < 4) {
            // protect against rapid retriggers
            inCooldown = true;
            // visually show selection
            const btns = optionsContainer.querySelectorAll('.option-btn');
            if (btns[chosenIndex]) {
              btns[chosenIndex].classList.add('selected-temp');
              setTimeout(()=> btns[chosenIndex].classList.remove('selected-temp'), 700);
            }
            // call selection logic
            onSelect(chosenIndex);
            // cooldown period
            setTimeout(()=> { inCooldown = false; stableLabel = null; stableCount = 0; }, COOLDOWN_MS);
          } else {
            // unknown label - ignore
            stableLabel = null; stableCount = 0;
          }
        }
      } else {
        // weak confidence -> decay stability
        if (stableCount > 0) stableCount = Math.max(0, stableCount - 1);
      }
    } catch (err) {
      console.error('prediction error', err);
    }
  }

  // toggle gesture on/off
  gestureToggle.addEventListener('click', async () => {
    if (!tmModel) {
      const ok = await loadTMModel();
      if (!ok) return;
    }
    if (!tmWebcam) {
      const ok = await startWebcam();
      if (!ok) return;
    }

    if (!detectIntervalId) {
      // enable
      gestureToggle.textContent = '🛑 Disable Gesture Mode';
      gestureToggle.setAttribute('aria-pressed', 'true');
      // start interval
      detectIntervalId = setInterval(detectOnce, DETECTION_INTERVAL_MS);
    } else {
      // disable
      gestureToggle.textContent = '✋ Enable Gesture Mode';
      gestureToggle.setAttribute('aria-pressed', 'false');
      clearInterval(detectIntervalId);
      detectIntervalId = null;
      stableLabel = null; stableCount = 0; inCooldown = false;
      stopWebcam();
    }
  });

  // boot
  window.addEventListener('DOMContentLoaded', () => {
    startRound();
    // warm tf (optional)
    if (window.tf && tf.ready) tf.ready().then(()=> console.log('tf ready'));
  });

})();
