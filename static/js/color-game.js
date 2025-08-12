let currentCorrectLetter = "";
let model, webcam;
let gestureEnabled = false;

// Load Teachable Machine color_gestures model
async function initGestureModel() {
    const modelURL = "/static/models/color_gestures/model.json";
    const metadataURL = "/static/models/color_gestures/metadata.json";
    model = await tmImage.load(modelURL, metadataURL);

    webcam = new tmImage.Webcam(300, 225, true);
    await webcam.setup();
    await webcam.play();
    document.getElementById("webcam").srcObject = webcam.webcam.stream;
    window.requestAnimationFrame(loop);
}

async function loop() {
    webcam.update();
    if (gestureEnabled) {
        await predictGesture();
    }
    window.requestAnimationFrame(loop);
}

async function predictGesture() {
    const prediction = await model.predict(webcam.canvas);
    prediction.sort((a, b) => b.probability - a.probability);
    const topPred = prediction[0];

    document.getElementById("gesture-result").innerText = 
        `Detected: ${topPred.className} — ${(topPred.probability * 100).toFixed(1)}%`;

    if (topPred.probability > 0.85) {
        if (topPred.className === currentCorrectLetter) {
            autoSelectCorrect();
        }
    }
}

function autoSelectCorrect() {
    document.querySelectorAll(".answer-btn").forEach(btn => {
        if (btn.innerText.charAt(0).toUpperCase() === currentCorrectLetter) {
            btn.click();
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const gestureToggle = document.getElementById("gesture-toggle");
    gestureToggle.addEventListener("change", (e) => {
        gestureEnabled = e.target.checked;
        if (gestureEnabled && !model) {
            initGestureModel();
            document.getElementById("webcam").style.display = "block";
        } else {
            document.getElementById("webcam").style.display = "none";
        }
    });

    document.querySelectorAll(".answer-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.innerText.charAt(0).toUpperCase() === currentCorrectLetter) {
                alert("✅ Correct!");
                loadNextQuestion();
            } else {
                alert("❌ Try Again!");
            }
        });
    });

    document.getElementById("next-btn").addEventListener("click", loadNextQuestion);
});

async function loadNextQuestion() {
    const res = await fetch("/color-quiz-next");
    const data = await res.json();

    document.getElementById("color-question").innerText = data.question;
    document.getElementById("color-display").style.backgroundColor = data.color_code;

    const btnContainer = document.getElementById("answer-buttons");
    btnContainer.innerHTML = "";
    data.options.forEach(opt => {
        const btn = document.createElement("button");
        btn.classList.add("answer-btn");
        btn.innerText = opt;
        btn.addEventListener("click", () => {
            if (opt.charAt(0).toUpperCase() === data.correct_letter) {
                alert("✅ Correct!");
                loadNextQuestion();
            } else {
                alert("❌ Try Again!");
            }
        });
        btnContainer.appendChild(btn);
    });

    currentCorrectLetter = data.correct_letter;
}
