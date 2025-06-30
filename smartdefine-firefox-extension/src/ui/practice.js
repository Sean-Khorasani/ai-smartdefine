// src/ui/practice.js
// Practice Mode Implementation with Multiple Quiz Types

class PracticeSession {
  constructor() {
    this.currentMode = null;
    this.words = [];
    this.currentIndex = 0;
    this.correctAnswers = 0;
    this.incorrectAnswers = 0;
    this.startTime = null;
    this.currentWordStartTime = null;
    this.sessionResults = [];
    this.isAnswered = false;
  }

  async init() {
    // Check for URL parameters to auto-start a mode
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    if (mode && ['flashcard', 'quiz', 'typing'].includes(mode)) {
      // Auto-start the specified mode
      this.startPractice(mode);
    } else {
      // Show mode selector initially
      this.showModeSelector();
    }
  }

  showModeSelector() {
    this.hideAllScreens();
    document.getElementById('modeSelector').style.display = 'block';
  }

  hideAllScreens() {
    const screens = ['modeSelector', 'loadingScreen', 'errorScreen', 'practiceSession', 'completionScreen'];
    screens.forEach(screen => {
      const element = document.getElementById(screen);
      if (element) {
        element.style.display = 'none';
      }
    });
  }

  async startPractice(mode) {
    this.currentMode = mode;
    this.hideAllScreens();
    document.getElementById('loadingScreen').style.display = 'block';

    try {
      // Get words for review from background
      const response = await browser.runtime.sendMessage({
        command: "getWordsForReview",
        reviewType: "all",
        limit: 20
      });

      if (response.success && response.words.length > 0) {
        this.words = response.words;
        this.shuffleArray(this.words); // Randomize order
        this.startTime = Date.now();
        this.resetStats();
        this.showPracticeSession();
        this.displayCurrentWord();
      } else {
        // Check if user has saved words at all
        const storage = await browser.storage.local.get(['wordLists']);
        const wordLists = storage.wordLists || {};
        const totalWords = Object.values(wordLists).reduce((total, category) => total + category.length, 0);
        
        if (totalWords === 0) {
          this.showError("No saved words found. Start by saving some words using the SmartDefine extension, then come back to practice!");
        } else {
          this.showError(`You have ${totalWords} saved words, but none are due for review right now. Practice sessions use spaced repetition - words become available for review based on your learning progress. Try again later, or save more words to practice!`);
        }
      }
    } catch (error) {
      console.error('Error starting practice:', error);
      this.showError("Failed to load practice session. Please try again.");
    }
  }

  showError(message) {
    this.hideAllScreens();
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorScreen').style.display = 'block';
  }

  resetStats() {
    this.currentIndex = 0;
    this.correctAnswers = 0;
    this.incorrectAnswers = 0;
    this.sessionResults = [];
    this.updateStats();
  }

  showPracticeSession() {
    this.hideAllScreens();
    document.getElementById('practiceSession').style.display = 'block';
    
    // Setup mode-specific elements
    this.setupModeElements();
  }

  setupModeElements() {
    const optionsContainer = document.getElementById('optionsContainer');
    const typingContainer = document.getElementById('typingContainer');
    const flashcardContainer = document.getElementById('flashcardContainer');
    const confidenceSlider = document.getElementById('confidenceSlider');

    // Hide all mode-specific elements
    optionsContainer.style.display = 'none';
    typingContainer.style.display = 'none';
    flashcardContainer.style.display = 'none';
    confidenceSlider.style.display = 'none';

    // Show relevant elements based on mode
    switch (this.currentMode) {
      case 'quiz':
        optionsContainer.style.display = 'block';
        break;
      case 'typing':
        typingContainer.style.display = 'block';
        break;
      case 'flashcard':
        flashcardContainer.style.display = 'block';
        confidenceSlider.style.display = 'block';
        break;
    }
  }

  displayCurrentWord() {
    if (this.currentIndex >= this.words.length) {
      this.showCompletion();
      return;
    }

    const word = this.words[this.currentIndex];
    this.currentWordStartTime = Date.now();
    this.isAnswered = false;

    // Update word display
    document.getElementById('wordText').textContent = word.word;
    document.getElementById('categoryBadge').textContent = word.category;

    // Update progress
    this.updateProgress();
    this.updateStats();

    // Hide explanation and next button
    document.getElementById('explanation').classList.remove('show');
    document.getElementById('nextBtn').style.display = 'none';
    document.getElementById('submitBtn').style.display = 'inline-block';

    // Setup mode-specific content
    this.setupWordContent(word);
  }

  setupWordContent(word) {
    switch (this.currentMode) {
      case 'quiz':
        this.setupQuizMode(word);
        break;
      case 'typing':
        this.setupTypingMode(word);
        break;
      case 'flashcard':
        this.setupFlashcardMode(word);
        break;
    }
  }

  setupQuizMode(word) {
    document.getElementById('questionText').textContent = `What does "${word.word}" mean?`;
    
    const correctDefinition = this.extractMeaning(word.explanation);
    const options = [correctDefinition];

    // Generate 3 distractors from other words
    const otherWords = this.words.filter(w => w.word !== word.word);
    while (options.length < 4 && otherWords.length > 0) {
      const randomWord = otherWords[Math.floor(Math.random() * otherWords.length)];
      const distractor = this.extractMeaning(randomWord.explanation);
      
      if (!options.includes(distractor)) {
        options.push(distractor);
      }
      
      otherWords.splice(otherWords.indexOf(randomWord), 1);
    }

    // Fill with generic distractors if needed
    const genericDistractors = [
      "A type of animal",
      "A cooking method",
      "A musical instrument",
      "A weather phenomenon",
      "A geographical feature",
      "A mathematical concept"
    ];

    while (options.length < 4) {
      const distractor = genericDistractors[Math.floor(Math.random() * genericDistractors.length)];
      if (!options.includes(distractor)) {
        options.push(distractor);
      }
    }

    // Shuffle options
    this.shuffleArray(options);
    this.correctAnswer = correctDefinition;

    // Create option elements
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';

    options.forEach((option, index) => {
      const optionElement = document.createElement('div');
      optionElement.className = 'option';
      optionElement.textContent = option;
      optionElement.onclick = () => this.selectOption(optionElement, option);
      optionsContainer.appendChild(optionElement);
    });
  }

  setupTypingMode(word) {
    document.getElementById('questionText').textContent = `Type the definition of "${word.word}":`;
    document.getElementById('typingInput').value = '';
    document.getElementById('typingInput').focus();
    this.correctAnswer = this.extractMeaning(word.explanation);
  }

  setupFlashcardMode(word) {
    document.getElementById('questionText').textContent = "Review this word:";
    // Format the explanation for better readability
    const formattedExplanation = this.formatExplanationForDisplay(word.explanation);
    const flashcardContent = document.getElementById('flashcardContent');
    flashcardContent.textContent = '';
    // Parse and create DOM elements safely without innerHTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(formattedExplanation, 'text/html');
    const elements = doc.body.childNodes;
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].nodeType === Node.ELEMENT_NODE || elements[i].nodeType === Node.TEXT_NODE) {
        flashcardContent.appendChild(elements[i].cloneNode(true));
      }
    }
    document.getElementById('showAnswerBtn').style.display = 'inline-block';
    document.getElementById('submitBtn').style.display = 'none';
    this.correctAnswer = word.explanation;
  }

  selectOption(element, option) {
    // Remove previous selection
    document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
    
    // Select current option
    element.classList.add('selected');
    this.selectedAnswer = option;
  }

  showFlashcardAnswer() {
    document.getElementById('showAnswerBtn').style.display = 'none';
    document.getElementById('submitBtn').style.display = 'inline-block';
    document.getElementById('submitBtn').textContent = 'Continue';
  }

  async submitAnswer() {
    if (this.isAnswered) return;

    const word = this.words[this.currentIndex];
    const responseTime = Date.now() - this.currentWordStartTime;
    let isCorrect = false;
    let userAnswer = '';

    switch (this.currentMode) {
      case 'quiz':
        if (!this.selectedAnswer) {
          alert('Please select an answer first.');
          return;
        }
        userAnswer = this.selectedAnswer;
        isCorrect = this.selectedAnswer === this.correctAnswer;
        this.showQuizResult(isCorrect);
        break;

      case 'typing':
        userAnswer = document.getElementById('typingInput').value.trim();
        if (!userAnswer) {
          alert('Please type an answer first.');
          return;
        }
        isCorrect = this.checkTypingAnswer(userAnswer, this.correctAnswer);
        this.showTypingResult(isCorrect, userAnswer);
        break;

      case 'flashcard':
        // For flashcards, we rely on user confidence
        const confidence = document.getElementById('confidenceRange').value / 100;
        isCorrect = confidence >= 0.7; // Consider high confidence as correct
        this.showFlashcardResult();
        break;
    }

    this.isAnswered = true;

    // Record result
    const result = {
      word: word.word,
      correct: isCorrect,
      responseTime: responseTime,
      confidence: this.currentMode === 'flashcard' ? 
        document.getElementById('confidenceRange').value / 100 : 
        (isCorrect ? 0.8 : 0.3),
      userAnswer: userAnswer
    };

    this.sessionResults.push(result);

    // Update stats
    if (isCorrect) {
      this.correctAnswers++;
    } else {
      this.incorrectAnswers++;
    }

    this.updateStats();

    // Process review with background engine
    await this.processWordReview(word, result);

    // Show explanation and next button
    this.showExplanation(word);
    document.getElementById('submitBtn').style.display = 'none';
    document.getElementById('nextBtn').style.display = 'inline-block';
  }

  showQuizResult(isCorrect) {
    const options = document.querySelectorAll('.option');
    options.forEach(option => {
      if (option.textContent === this.correctAnswer) {
        option.classList.add('correct');
      } else if (option.classList.contains('selected') && !isCorrect) {
        option.classList.add('incorrect');
      }
      option.onclick = null; // Disable clicking
    });
  }

  showTypingResult(isCorrect, userAnswer) {
    const input = document.getElementById('typingInput');
    input.style.borderColor = isCorrect ? '#4CAF50' : '#f44336';
    input.style.backgroundColor = isCorrect ? '#e8f5e8' : '#ffebee';
    input.readOnly = true;
  }

  showFlashcardResult() {
    // Flashcard result is based on confidence, no visual changes needed
  }

  checkTypingAnswer(userAnswer, correctAnswer) {
    // Simple fuzzy matching for typing mode
    const userLower = userAnswer.toLowerCase().trim();
    const correctLower = correctAnswer.toLowerCase().trim();
    
    // Exact match
    if (userLower === correctLower) return true;
    
    // Check if user answer contains key words from correct answer
    const correctWords = correctLower.split(/\s+/).filter(word => word.length > 3);
    const userWords = userLower.split(/\s+/);
    
    let matchCount = 0;
    correctWords.forEach(word => {
      if (userWords.some(userWord => userWord.includes(word) || word.includes(userWord))) {
        matchCount++;
      }
    });
    
    // Consider correct if 70% of key words match
    return matchCount / correctWords.length >= 0.7;
  }

  showExplanation(word) {
    const formattedExplanation = this.formatExplanationForDisplay(word.explanation);
    const explanationContent = document.getElementById('explanationContent');
    explanationContent.textContent = '';
    // Parse and create DOM elements safely without innerHTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(formattedExplanation, 'text/html');
    const elements = doc.body.childNodes;
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].nodeType === Node.ELEMENT_NODE || elements[i].nodeType === Node.TEXT_NODE) {
        explanationContent.appendChild(elements[i].cloneNode(true));
      }
    }
    document.getElementById('explanation').classList.add('show');
  }

  async processWordReview(wordData, result) {
    try {
      await browser.runtime.sendMessage({
        command: "processWordReview",
        wordData: wordData,
        reviewResult: {
          isCorrect: result.correct,
          responseTime: result.responseTime,
          confidenceLevel: result.confidence
        }
      });
    } catch (error) {
      console.error('Error processing word review:', error);
    }
  }

  nextWord() {
    this.currentIndex++;
    
    // Reset UI elements
    document.getElementById('typingInput').readOnly = false;
    document.getElementById('typingInput').style.borderColor = '#e0e0e0';
    document.getElementById('typingInput').style.backgroundColor = 'white';
    document.getElementById('confidenceRange').value = '50';
    this.selectedAnswer = null;

    this.displayCurrentWord();
  }

  skipWord() {
    // Record as incorrect skip
    const word = this.words[this.currentIndex];
    const result = {
      word: word.word,
      correct: false,
      responseTime: Date.now() - this.currentWordStartTime,
      confidence: 0.1,
      userAnswer: 'Skipped'
    };

    this.sessionResults.push(result);
    this.incorrectAnswers++;
    this.nextWord();
  }

  updateStats() {
    document.getElementById('currentWord').textContent = this.currentIndex + 1;
    document.getElementById('totalWords').textContent = this.words.length;
    document.getElementById('correctCount').textContent = this.correctAnswers;
    
    const total = this.correctAnswers + this.incorrectAnswers;
    const accuracy = total > 0 ? Math.round((this.correctAnswers / total) * 100) : 0;
    document.getElementById('accuracy').textContent = accuracy + '%';
  }

  updateProgress() {
    const progress = ((this.currentIndex) / this.words.length) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
  }

  showCompletion() {
    this.hideAllScreens();
    document.getElementById('completionScreen').style.display = 'block';

    // Calculate final stats
    const totalTime = Date.now() - this.startTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);
    
    const total = this.correctAnswers + this.incorrectAnswers;
    const accuracy = total > 0 ? Math.round((this.correctAnswers / total) * 100) : 0;

    // Update completion screen
    document.getElementById('finalCorrect').textContent = this.correctAnswers;
    document.getElementById('finalIncorrect').textContent = this.incorrectAnswers;
    document.getElementById('finalAccuracy').textContent = accuracy + '%';
    document.getElementById('finalTime').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  extractMeaning(explanation) {
    // Extract the meaning from the full explanation
    const lines = explanation.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toLowerCase().includes('meaning') && i + 1 < lines.length) {
        const meaningLine = lines[i + 1].trim();
        if (meaningLine && !meaningLine.toLowerCase().includes('respelling')) {
          return meaningLine;
        }
      }
    }
    
    // Fallback: return first non-empty line
    const firstLine = lines.find(line => line.trim().length > 0);
    return firstLine || 'Definition not available';
  }

  formatExplanationForDisplay(explanation) {
    if (!explanation) return 'No explanation available';
    
    // Convert markdown-style formatting to HTML
    return explanation
      // Convert **bold** to <strong>
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Convert headers (### to h4, ## to h3, # to h2)
      .replace(/^#{3}\s*(.+)$/gm, '<h4 style="color: #2196F3; margin: 15px 0 8px 0; font-size: 16px;">$1</h4>')
      .replace(/^#{2}\s*(.+)$/gm, '<h3 style="color: #2196F3; margin: 15px 0 8px 0; font-size: 18px;">$1</h3>')
      .replace(/^#{1}\s*(.+)$/gm, '<h2 style="color: #2196F3; margin: 15px 0 8px 0; font-size: 20px;">$1</h2>')
      // Convert lists (- item to bullet points)
      .replace(/^[-*+]\s+(.+)$/gm, '• $1')
      // Convert line breaks to <br> tags
      .replace(/\n/g, '<br>')
      // Clean up multiple breaks
      .replace(/(<br\s*\/?>\s*){3,}/g, '<br><br>');
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

// Global functions for HTML onclick handlers
window.startPractice = function(mode) {
  practiceSession.startPractice(mode);
};

window.submitAnswer = function() {
  practiceSession.submitAnswer();
};

window.nextWord = function() {
  practiceSession.nextWord();
};

window.skipWord = function() {
  practiceSession.skipWord();
};

window.showFlashcardAnswer = function() {
  practiceSession.showFlashcardAnswer();
};

window.startNewSession = function() {
  practiceSession.showModeSelector();
};

window.goToWordList = function() {
  browser.tabs.create({
    url: browser.runtime.getURL('src/ui/extension_tabs.html?tab=wordlist')
  });
  window.close();
};

// Initialize practice session
let practiceSession;

document.addEventListener('DOMContentLoaded', () => {
  practiceSession = new PracticeSession();
  practiceSession.init();

  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (practiceSession.currentMode && !practiceSession.isAnswered) {
      // Number keys for quiz mode
      if (practiceSession.currentMode === 'quiz' && e.key >= '1' && e.key <= '4') {
        const optionIndex = parseInt(e.key) - 1;
        const options = document.querySelectorAll('.option');
        if (options[optionIndex]) {
          practiceSession.selectOption(options[optionIndex], options[optionIndex].textContent);
        }
      }
      
      // Enter to submit
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (document.getElementById('submitBtn').style.display !== 'none') {
          practiceSession.submitAnswer();
        } else if (document.getElementById('nextBtn').style.display !== 'none') {
          practiceSession.nextWord();
        }
      }
      
      // Space to skip
      if (e.key === ' ' && e.ctrlKey) {
        e.preventDefault();
        practiceSession.skipWord();
      }
    }
  });
});