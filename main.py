from flask import Flask, render_template, request, jsonify, send_from_directory
import json, os, random
from datetime import datetime

app = Flask(__name__, static_folder='static', template_folder='templates')

# keep existing scores file behavior
SCORES_FILE = 'scores.json'
if not os.path.exists(SCORES_FILE):
    with open(SCORES_FILE, 'w') as f:
        json.dump([], f)

# -----------------------
# Core pages (existing)
# -----------------------
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/math')
def math_game():
    return render_template('math.html')

@app.route('/az-sign')
def az_sign():
    return render_template('az_sign.html')

@app.route('/puzzle')
def puzzle_game():
    return render_template('puzzle.html')

@app.route('/grammar')
def grammar_game():
    return render_template('grammar.html')

# Old color route kept for compatibility (optional)
@app.route('/color')
def color_game():
    return render_template('color_quiz.html')

# -----------------------
# NEW: Color Quiz (multiple questions + gesture)
# -----------------------
# Sample color questions (you can expand this list)
COLOR_QUESTIONS = [
    {"question": "Which color is the sky on a clear day?", "answer": "Blue",
     "options": ["Blue", "Green", "Red", "Yellow"]},
    {"question": "What color are bananas?", "answer": "Yellow",
     "options": ["Yellow", "Red", "Orange", "Pink"]},
    {"question": "Which color is made by mixing red and blue?", "answer": "Purple",
     "options": ["Purple", "Brown", "Green", "Grey"]},
    {"question": "What color is grass?", "answer": "Green",
     "options": ["Green", "Blue", "Black", "Red"]},
    {"question": "What color is fire?", "answer": "Orange",
     "options": ["Orange", "Pink", "Blue", "White"]},
    {"question": "What color are strawberries?", "answer": "Red",
     "options": ["Red", "Blue", "Yellow", "Green"]},
    {"question": "What color is a lemon?", "answer": "Yellow",
     "options": ["Yellow", "Blue", "Brown", "Pink"]},
    {"question": "What color is the ocean?", "answer": "Blue",
     "options": ["Blue", "Red", "Green", "Orange"]},
    {"question": "Which color is a ripe apple most often?", "answer": "Red",
     "options": ["Red", "Purple", "Black", "Yellow"]},
    {"question": "What color is snow?", "answer": "White",
     "options": ["White", "Green", "Blue", "Brown"]}
]

@app.route('/color_quiz')
def color_quiz():
    # choose a random question each time
    q = random.choice(COLOR_QUESTIONS)
    return render_template('color_quiz.html', question=q)

@app.route('/check_color_answer', methods=['POST'])
def check_color_answer():
    data = request.get_json() or {}
    user_answer = (data.get("answer") or "").strip().lower()
    correct_answer = (data.get("correct") or "").strip().lower()

    result = "wrong"
    if user_answer and correct_answer and user_answer == correct_answer:
        result = "correct"

    # Optionally record score
    try:
        score_rec = {
            "game": "color_quiz",
            "question": data.get("question", ""),
            "answer_given": user_answer,
            "correct_answer": correct_answer,
            "result": result,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        with open(SCORES_FILE, 'r+') as f:
            arr = json.load(f)
            arr.append(score_rec)
            f.seek(0)
            json.dump(arr, f, indent=2)
            f.truncate()
    except Exception:
        # don't break on logging errors
        pass

    return jsonify({"result": result})

# -----------------------
# Keep score API from earlier
# -----------------------
@app.route('/api/score', methods=['POST'])
def save_score():
    data = request.get_json()
    if not data:
        return jsonify({'ok': False, 'error': 'no json'}), 400
    data['timestamp'] = datetime.utcnow().isoformat() + 'Z'
    with open(SCORES_FILE, 'r+') as f:
        arr = json.load(f)
        arr.append(data)
        f.seek(0)
        json.dump(arr, f, indent=2)
        f.truncate()
    return jsonify({'ok': True})

# serve model files (optional convenience route)
@app.route('/models/<path:filename>')
def models(filename):
    return send_from_directory(os.path.join(app.root_path, 'static', 'models'), filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
