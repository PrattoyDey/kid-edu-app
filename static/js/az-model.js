/* A→Z sign recognition logic.
   - This script will try to load a TF.js model from /static/models/az/model.json
   - If not found, the page still works as a tap-based letter quiz.
   - It uses MediaPipe pipeline for camera + visualization, and then classifies frames with TF.js
*/

(function(){
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const alphabetGrid = document.getElementById('alphabet-grid');
  const letterDisplay = document.getElementById('letter-display');
  const feedback = document.getElementById('feedback');
  const webcam = document.getElementById('webcam');
  const canvas = document.getElementById('output_canvas');
  const gestureToggle = document.getElementById('gesture-toggle');
  const teachToggle = document.getElementById('teach-toggle');
  const webcamContainer = document.getElementById('webcam-container');
  const modelWarning = document.getElementById('model-warning');

  let model = null;
  let pipeline = null;
  let expecting = 'A';
  let classifyInterval = null;
  let lastPred = null;
  let stableFrames = 0;

  // populate alphabet buttons
  letters.forEach(l=>{
    const btn = document.createElement('button');
    btn.textContent = l;
    btn.addEventListener('click', () => selectLetter(l));
    alphabetGrid.appendChild(btn);
  });

  function selectLetter(l){
    expecting = l;
    letterDisplay.textContent = l;
    feedback.textContent = '';
  }

  // load model if present
  async function tryLoadModel(){
    try {
      modelWarning.textContent = 'Loading model...';
      model = await tf.loadLayersModel('/models/az/model.json');
      modelWarning.textContent = 'Model loaded. Turn on camera to classify signs.';
      console.log('AZ model loaded', model);
    } catch (err){
      console.warn('model not found or failed to load', err);
      modelWarning.textContent = 'No model found at /static/models/az/ — place Teachable Machine TFJS export there to enable camera recognition.';
      model = null;
    }
  }

  async function classifyCanvasFrame(){
    if(!model) return;
    const t = tf.browser.fromPixels(canvas).resizeNearestNeighbor([224,224]).toFloat().div(255).expandDims(0);
    const preds = await model.predict(t).data();
    t.dispose();
    const maxIdx = preds.indexOf(Math.max(...preds));
    const confidence = preds[maxIdx];
    const letter = letters[maxIdx] || '?';
    // require high confidence
    if (confidence > 0.75){
      if (letter === lastPred) stableFrames++;
      else { lastPred = letter; stableFrames = 1; }
      if (stableFrames >= 5){
        // accept
        if (letter === expecting){
          feedback.textContent = `Nice! That's ${letter} ✅`;
          feedback.className = 'feedback good';
          window.app.postScore({game:'az',score:1,detail:`${letter} recognized`});
        } else {
          feedback.textContent = `Try again — I saw ${letter}. (expected ${expecting})`;
          feedback.className = 'feedback bad';
          window.app.postScore({game:'az',score:0,detail:`saw ${letter} expected ${expecting}`});
        }
        stableFrames = 0;
      }
    } else {
      // low confidence
      stableFrames = 0;
    }
  }

  function onLandmarks(landmarks){
    // keep for optional landmark-based features or UI
    // no-op here; classification uses image model
  }

  function startCameraPipeline(){
    if (pipeline) return;
    webcamContainer.style.display = 'flex';
    pipeline = window.MP.startHandPipeline(webcam, canvas, onLandmarks, {width:640, height:480});
    if (model){
      classifyInterval = setInterval(classifyCanvasFrame, 200); // every 200ms
    }
  }

  function stopCameraPipeline(){
    if (!pipeline) return;
    pipeline.stop();
    pipeline = null; 
    webcamContainer.style.display = 'none';
    if (classifyInterval) { clearInterval(classifyInterval); classifyInterval = null; }
  }

  // toggles
  gestureToggle && gestureToggle.addEventListener('change', (e)=>{
    if (e.target.checked) startCameraPipeline();
    else stopCameraPipeline();
  });

  // teach toggle: just toggles some hinting; no heavy behavior here
  teachToggle && teachToggle.addEventListener('change', (e)=>{
    if (e.target.checked) {
      modelWarning.textContent = 'Teach mode: repeat the expected sign for the child to copy.';
    } else {
      modelWarning.textContent = model ? 'Model loaded. Use camera to classify' : modelWarning.textContent;
    }
  });

  // initialize
  (async function init(){
    selectLetter('A');
    await tryLoadModel();
  })();

})();
