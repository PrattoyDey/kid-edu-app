/*
  Mediapipe helper (no modules) — attaches to window
  Requires MediaPipe CDN scripts:
  - drawing_utils.js
  - camera_utils.js
  - hands.js
*/

(function(window){
  function startHandPipeline(videoEl, canvasEl, onLandmarks, options){
    options = options || {};
    const canvasCtx = canvasEl.getContext('2d');

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: options.modelComplexity || 0,
      minDetectionConfidence: options.minDetectionConfidence || 0.6,
      minTrackingConfidence: options.minTrackingConfidence || 0.5
    });

    hands.onResults((results) => {
      canvasCtx.save();
      canvasCtx.clearRect(0,0,canvasEl.width, canvasEl.height);
      if (results.image) {
        canvasCtx.drawImage(results.image, 0, 0, canvasEl.width, canvasEl.height);
      }
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        if (typeof drawingUtils !== 'undefined' && drawingUtils) {
          drawingUtils.drawConnectors(canvasCtx, lm, Hands.HAND_CONNECTIONS, {color:'#00FF88', lineWidth:2});
          drawingUtils.drawLandmarks(canvasCtx, lm, {color:'#FF0066', lineWidth:1});
        }
        if (onLandmarks) onLandmarks(lm);
      } else {
        if (onLandmarks) onLandmarks(null);
      }
      canvasCtx.restore();
    });

    const camera = new Camera(videoEl, {
      onFrame: async () => {
        await hands.send({image: videoEl});
      },
      width: options.width || 640,
      height: options.height || 480
    });
    camera.start();

    return {
      stop: () => camera.stop()
    };
  }

  function countRaisedFingers(landmarks){
    if (!landmarks) return 0;
    // indices: tips [4,8,12,16,20], pip-like [2,6,10,14,18]
    const tips = [4,8,12,16,20];
    const pip  = [2,6,10,14,18];
    let up = [];

    // index..pinky: tip.y < pip.y means finger up (camera y increases downward)
    for (let i=1;i<5;i++){
      up.push( landmarks[tips[i]].y < landmarks[pip[i]].y ? 1 : 0 );
    }
    // simple thumb rule: compare x of thumb tip and ip joint
    const thumbOpen = Math.abs(landmarks[4].x - landmarks[3].x) > 0.04;
    up.unshift( thumbOpen ? 1 : 0 );
    return up.reduce((a,b)=>a+b,0);
  }

  window.MP = window.MP || {};
  window.MP.startHandPipeline = startHandPipeline;
  window.MP.countRaisedFingers = countRaisedFingers;
})(window);
