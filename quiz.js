// assets/js/pages/quiz.js

let currentQuestions = [];

(async function init() {
  const profile = await requireAuth();
  if (!profile) return;
  renderSidebar("academy", profile);

  const params = new URLSearchParams(window.location.search);
  const quizId = params.get("quiz");

  if (!quizId) {
    document.getElementById("questionsContainer").innerHTML =
      '<p class="loading-text">Aucun quiz sélectionné.</p>';
    return;
  }

  try {
    const { quiz, questions } = await callEdgeFunction("get-quiz", { quiz_id: quizId });
    currentQuestions = questions;
    document.getElementById("quizTitle").textContent = quiz.title || "Quiz";
    renderQuestions(questions, quiz.passing_score);
  } catch (err) {
    console.error("Erreur chargement quiz:", err);
    document.getElementById("questionsContainer").innerHTML = "";
    document.getElementById("quizMessage").className = "form-message error";
    document.getElementById("quizMessage").textContent = err.message;
  }

  document.getElementById("quizForm").addEventListener("submit", (e) => {
    e.preventDefault();
    submitQuiz(quizId);
  });
})();

function renderQuestions(questions, passingScore) {
  document.getElementById("questionsContainer").innerHTML = `
    <p style="color:var(--color-text-muted);font-size:14px;margin-bottom:16px;">
      ${questions.length} questions · ${passingScore}% requis pour réussir
    </p>
    ${questions
      .map(
        (q, idx) => `
      <div class="quiz-question card">
        <p class="quiz-question-text">${idx + 1}. ${q.question_text}</p>
        <div class="quiz-options">
          ${q.options
            .map(
              (opt) => `
            <label class="quiz-option">
              <input type="radio" name="q_${q.id}" value="${opt.id}" required />
              <span>${opt.text}</span>
            </label>`
            )
            .join("")}
        </div>
      </div>`
      )
      .join("")}
  `;
  document.getElementById("submitQuizBtn").style.display = "inline-block";
}

async function submitQuiz(quizId) {
  const answers = currentQuestions.map((q) => {
    const selected = document.querySelector(`input[name="q_${q.id}"]:checked`);
    return { question_id: q.id, selected_option_id: selected ? selected.value : null };
  });

  if (answers.some((a) => !a.selected_option_id)) {
    document.getElementById("quizMessage").className = "form-message error";
    document.getElementById("quizMessage").textContent = "Veuillez répondre à toutes les questions.";
    return;
  }

  const submitBtn = document.getElementById("submitQuizBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Envoi...";

  try {
    const result = await callEdgeFunction("submit-quiz", { quiz_id: quizId, answers });

    document.getElementById("quizForm").style.display = "none";
    const resultCard = document.getElementById("resultCard");
    resultCard.style.display = "block";
    document.getElementById("resultTitle").textContent = result.passed
      ? "✓ Quiz réussi !"
      : "Quiz non réussi";
    document.getElementById("resultDetail").textContent = `Score : ${result.score}% (${result.correct_count}/${result.total} bonnes réponses) — ${result.passing_score}% requis.`;
  } catch (err) {
    console.error("Erreur soumission quiz:", err);
    document.getElementById("quizMessage").className = "form-message error";
    document.getElementById("quizMessage").textContent = err.message;
    submitBtn.disabled = false;
    submitBtn.textContent = "Valider le quiz";
  }
}
