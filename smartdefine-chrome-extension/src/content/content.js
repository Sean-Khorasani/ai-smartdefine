// src/content/content.js

/**
 * Helper function to create DOM elements from structured data
 * @param {string} tag - The HTML tag to create
 * @param {object} attributes - Attributes to set on the element
 * @param {string|Element|Array} content - Content to add to the element
 * @returns {HTMLElement} The created element
 */
function createElement(tag, attributes = {}, content = null) {
  const element = document.createElement(tag);
  
  // Set attributes
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'style') {
      element.style.cssText = value;
    } else if (key === 'className') {
      element.className = value;
    } else {
      element.setAttribute(key, value);
    }
  });
  
  // Add content
  if (content !== null) {
    if (typeof content === 'string') {
      element.textContent = content;
    } else if (content instanceof Element) {
      element.appendChild(content);
    } else if (Array.isArray(content)) {
      content.forEach(child => {
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        } else if (child instanceof Element) {
          element.appendChild(child);
        }
      });
    }
  }
  
  return element;
}

// Safely set HTML using DOMParser to avoid innerHTML
function safeSetHTML(element, htmlString) {
  if (!element) return;
  const parser = new DOMParser();
  const parsed = parser.parseFromString(htmlString, 'text/html');
  element.textContent = '';
  parsed.body.childNodes.forEach(node => {
    element.appendChild(node.cloneNode(true));
  });
}

// Map of common irregular forms to their base forms
const irregularVerbMap = {
  'ate': 'eat',
  'began': 'begin',
  'begun': 'begin',
  'bought': 'buy',
  'caught': 'catch',
  'came': 'come',
  'done': 'do',
  'drove': 'drive',
  'driven': 'drive',
  'fell': 'fall',
  'felt': 'feel',
  'found': 'find',
  'flew': 'fly',
  'gone': 'go',
  'went': 'go',
  'ran': 'run',
  'saw': 'see',
  'seen': 'see',
  'was': 'be',
  'were': 'be',
  'been': 'be',
  'wrote': 'write',
  'written': 'write'
};

// Basic heuristic to detect base form, word type and other forms
async function getWordFormInfo(word) {
  const lower = word.toLowerCase().trim();
  let base = lower;
  let form = 'base form';
  let type = 'unknown';

  // Check irregular forms first
  if (irregularVerbMap[lower]) {
    base = irregularVerbMap[lower];
    type = 'verb';
    form = 'past tense';
  } else if (lower.endsWith('ied')) {
    base = lower.slice(0, -3) + 'y';
    type = 'verb';
    form = 'past tense';
  } else if (lower.endsWith('ed')) {
    let candidate = lower.slice(0, -2);
    if (lower.slice(0, -1) === candidate + 'e') {
      base = candidate + 'e';
    } else if (/([b-df-hj-np-tv-z])\1$/.test(candidate)) {
      base = candidate.slice(0, -1);
    } else {
      base = candidate;
    }
    type = 'verb';
    form = 'past tense';
  } else if (lower.endsWith('ing')) {
    base = lower.slice(0, -3);
    type = 'verb';
    form = 'present participle';
  } else if (lower.endsWith('es')) {
    base = lower.slice(0, -2);
    type = 'verb/noun';
    form = 'third-person singular or plural';
  } else if (lower.endsWith('s') && lower.length > 3) {
    base = lower.slice(0, -1);
    type = 'verb/noun';
    form = 'third-person singular or plural';
  } else if (lower.endsWith('er')) {
    base = lower.slice(0, -2);
    type = 'adjective';
    form = 'comparative';
  } else if (lower.endsWith('est')) {
    base = lower.slice(0, -3);
    type = 'adjective';
    form = 'superlative';
  } else if (lower.endsWith('ically')) {
    const cand1 = lower.slice(0, -4); // remove 'ally'
    const cand2 = lower.slice(0, -2); // remove 'ly'
    if (await dictionaryWordExists(cand1)) {
      base = cand1;
    } else if (await dictionaryWordExists(cand2)) {
      base = cand2;
    } else {
      base = cand1;
    }
    type = 'adverb';
    form = 'adverb';
  } else if (lower.endsWith('ly')) {
    base = lower.slice(0, -2);
    type = 'adverb';
    form = 'adverb';
  }

  // Try dictionary lookup for irregular words or if base still equals original
  if (base === lower) {
    const dictBase = await lookupBaseFromDictionary(lower);
    if (dictBase) {
      base = dictBase;
    }
  }

  const forms = [];
  if (type.startsWith('verb')) {
    forms.push({ form: 'base', word: base, example: `to ${base}` });
    forms.push({ form: '3rd person singular', word: base + 's', example: `He ${base}s.` });
    forms.push({ form: 'past', word: base + 'ed', example: `They ${base}ed.` });
    forms.push({ form: 'present participle', word: base + 'ing', example: `I am ${base}ing.` });
  } else if (type === 'noun' || type === 'verb/noun') {
    forms.push({ form: 'singular', word: base, example: `a ${base}` });
    forms.push({ form: 'plural', word: base + 's', example: `many ${base}s` });
    forms.push({ form: 'possessive', word: `${base}'s`, example: `${base}'s example` });
  } else if (type === 'adjective') {
    forms.push({ form: 'positive', word: base, example: `a ${base} thing` });
    forms.push({ form: 'comparative', word: base + 'er', example: `a ${base}er thing` });
    forms.push({ form: 'superlative', word: base + 'est', example: `the ${base}est thing` });
  }

  return { base, form, type, forms };
}

// Lookup base form from dictionary service using sourceUrls
async function lookupBaseFromDictionary(word) {
  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data[0] && Array.isArray(data[0].sourceUrls)) {
      for (const src of data[0].sourceUrls) {
        const match = /\/wiki\/([^#]+)/.exec(src);
        if (match) {
          const candidate = match[1].toLowerCase();
          if (candidate !== word.toLowerCase()) {
            return candidate;
          }
        }
      }
    }
  } catch (err) {
    console.warn('lookupBaseFromDictionary error', err);
  }
  return null;
}

// Check if a word exists in the dictionary service
async function dictionaryWordExists(word) {
  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
    const response = await fetch(url);
    return response.ok;
  } catch (err) {
    console.warn('dictionaryWordExists error', err);
    return false;
  }
}

// Prepend word type and form information to an explanation if missing
async function addWordInfoToExplanation(word, explanation) {
  const formInfo = await getWordFormInfo(word);
  let finalExplanation = explanation.trim();
  if (!finalExplanation.toLowerCase().includes('word type')) {
    const infoLines = [`Word Type: ${formInfo.type}`, `Current Form: ${formInfo.form}`];
    if (formInfo.forms.length > 0) {
      infoLines.push('Other Forms:');
      formInfo.forms.forEach(f => {
        infoLines.push(`- ${f.word} (${f.form}) - ${f.example}`);
      });
    }
    finalExplanation = infoLines.join('\n') + '\n\n' + finalExplanation;
  }
  return finalExplanation;
}

/**
 * Creates and displays a modal dialog with the LLM's formatted response.
 * @param {string} selectedText - The text the user selected.
 * @param {string} response - The response from the LLM.
 */
async function createResponseModal(selectedText, response, context = null, provider = null) {
  // Remove any existing modal to prevent duplicates
  const existingModal = document.getElementById('smartdefine-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Get learning settings
  const storage = await browser.storage.local.get(['learningSettings']);
  const learningSettings = storage.learningSettings || {
    saveToWordList: true,
    showSaveButton: true
  };

  // --- Modal Container ---
  const modal = document.createElement('div');
  modal.id = 'smartdefine-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    z-index: 2147483647; /* Use a very high z-index */
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.3s ease-out;
  `;

  // --- Modal Content Box ---
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    padding: 0;
    border-radius: 16px;
    width: 90%;
    max-width: 700px;
    max-height: 85vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    position: relative;
    animation: slideIn 0.3s ease-out;
    border: 1px solid rgba(255, 255, 255, 0.2);
  `;

  // --- CSS Styles and Animations ---
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideIn {
      from { transform: translateY(-20px) scale(0.95); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    /* Styles for the formatted content area */
    .smartdefine-content-area h3 {
      font-size: 18px;
      font-weight: 600;
      color: #1a202c; /* Darker text for headers */
      margin-top: 24px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0; /* Subtle separator */
    }
    .smartdefine-content-area h3:first-child {
      margin-top: 0;
    }
    .smartdefine-content-area p {
      margin: 0 0 16px 0;
      color: #4a5568; /* Softer text for paragraphs */
      line-height: 1.6;
      font-size: 16px;
    }
    .smartdefine-content-area ul {
      margin: 0 0 16px 0;
      padding-left: 20px;
      color: #4a5568;
    }
    .smartdefine-content-area li {
      margin-bottom: 8px;
      line-height: 1.6;
      font-size: 16px;
      padding-left: 4px;
    }
    /* Bolding text for emphasis, like in the target design */
    .smartdefine-content-area li strong, .smartdefine-content-area p strong {
      color: #2d3748;
      font-weight: 600;
    }
  `;
  document.head.appendChild(style);

  // --- Modal Header ---
  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    color: white;
    padding: 20px 24px;
    position: relative;
    flex-shrink: 0; /* Prevents header from shrinking */
  `;

  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 16px;
    right: 20px;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: all 0.2s ease;
  `;
  closeButton.onmouseover = () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.3)';
    closeButton.style.transform = 'scale(1.1)';
  };
  closeButton.onmouseout = () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
    closeButton.style.transform = 'scale(1)';
  };
  closeButton.onclick = () => modal.remove();

  const title = document.createElement('h2');
  title.textContent = selectedText;
  title.style.cssText = `
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    max-width: 70%;
  `;

  const subtitle = document.createElement('p');
  subtitle.textContent = 'AI-Powered Word Explanation';
  subtitle.style.cssText = `
    margin: 4px 0 0 0;
    opacity: 0.9;
    font-size: 14px;
    font-weight: 400;
  `;

  header.appendChild(closeButton);
  header.appendChild(title);
  header.appendChild(subtitle);

  // Add save button if enabled in settings (will be added later in createResponseModal function)

  // --- Modal Content Area ---
  const contentArea = document.createElement('div');
  contentArea.className = 'smartdefine-content-area'; // Add class for specific styling
  contentArea.style.cssText = `
    padding: 24px;
    overflow-y: auto;
    flex-grow: 1; /* Allows content to fill available space */
  `;

  // Word type and form information
  const wordInfo = await getWordFormInfo(selectedText);
  const infoDiv = document.createElement('div');
  infoDiv.style.cssText = 'margin-bottom: 16px;';
  let infoHTML = `<strong>Word Type:</strong> ${wordInfo.type}<br><strong>Current Form:</strong> ${wordInfo.form}`;
  if (wordInfo.forms.length > 0) {
    infoHTML += '<br><strong>Other Forms:</strong><ul>';
    wordInfo.forms.forEach(f => {
      infoHTML += `<li>${f.word} (${f.form}) - ${f.example}</li>`;
    });
    infoHTML += '</ul>';
  }
  safeSetHTML(infoDiv, infoHTML);
  contentArea.appendChild(infoDiv);

  // Parse and format the response using DOM methods
  const formattedContent = formatLLMResponse(response, selectedText);
  contentArea.appendChild(formattedContent);

  // Add context information if available
  if (context && (context.fullSentence || (context.before && context.after))) {
    const contextSection = document.createElement('div');
    contextSection.style.cssText = `
      background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%);
      border: 1px solid #b3d9ff;
      border-radius: 12px;
      padding: 16px;
      margin: 20px 24px;
      font-size: 14px;
    `;
    
    let contextHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <span style="font-size: 18px;">🎯</span>
        <h4 style="margin: 0; color: #1e40af; font-size: 16px; font-weight: 600;">Context Information</h4>
      </div>
    `;
    
    if (context.fullSentence) {
      contextHTML += `
        <div style="margin-bottom: 8px;">
          <strong style="color: #1e40af;">Full sentence:</strong><br>
          <span style="color: #374151; font-style: italic;">"${context.fullSentence}"</span>
        </div>
      `;
    }
    
    if (context.before && context.after) {
      contextHTML += `
        <div>
          <strong style="color: #1e40af;">Surrounding text:</strong><br>
          <span style="color: #6b7280;">...${context.before}</span> 
          <span style="background: #fef3c7; padding: 2px 4px; border-radius: 4px; font-weight: 600;">${selectedText}</span> 
          <span style="color: #6b7280;">${context.after}...</span>
        </div>
      `;
    }
    
    safeSetHTML(contextSection, contextHTML);
    modalContent.insertBefore(contextSection, contentArea.nextSibling);
  }

  // --- Assemble Modal ---
  modalContent.appendChild(header);
  modalContent.appendChild(contentArea);
  modal.appendChild(modalContent);

  // Add save button if enabled and not loading
  if (learningSettings.saveToWordList && learningSettings.showSaveButton && response !== "Loading explanation...") {
    const saveButton = document.createElement('button');
    saveButton.innerHTML = '🔖';
    saveButton.title = 'Save to Word List';
    saveButton.style.cssText = `
      position: absolute;
      top: 16px;
      right: 140px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: all 0.2s ease;
    `;
    saveButton.onmouseover = () => {
      saveButton.style.background = 'rgba(255, 255, 255, 0.3)';
      saveButton.style.transform = 'scale(1.1)';
    };
    saveButton.onmouseout = () => {
      saveButton.style.background = 'rgba(255, 255, 255, 0.2)';
      saveButton.style.transform = 'scale(1)';
    };
    saveButton.onclick = async () => {
      // Extract context for saving
      const learningSettings = await browser.storage.local.get(['learningSettings']);
      const context = learningSettings.learningSettings?.contextAwareDefinitions ? extractContext(selectedText) : null;
      showSaveToListModal(selectedText, response, context, provider);
    };
    
    header.appendChild(saveButton);
  }

  // Add export button if not loading
  if (response !== "Loading explanation...") {
    const exportButton = document.createElement('button');
    exportButton.innerHTML = '📤';
    exportButton.title = 'Export Word';
    exportButton.style.cssText = `
      position: absolute;
      top: 16px;
      right: 60px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: all 0.2s ease;
    `;
    exportButton.onmouseover = () => {
      exportButton.style.background = 'rgba(255, 255, 255, 0.3)';
      exportButton.style.transform = 'scale(1.1)';
    };
    exportButton.onmouseout = () => {
      exportButton.style.background = 'rgba(255, 255, 255, 0.2)';
      exportButton.style.transform = 'scale(1)';
    };
    exportButton.onclick = () => showExportModal(selectedText, response);
    
    header.appendChild(exportButton);
  }

  // Add pronunciation button if Web Speech API is available and not loading
  if (response !== "Loading explanation..." && 'speechSynthesis' in window) {
    const pronunciationButton = document.createElement('button');
    pronunciationButton.innerHTML = '🔊';
    pronunciationButton.title = 'Play Pronunciation';
    pronunciationButton.style.cssText = `
      position: absolute;
      top: 16px;
      right: 100px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: all 0.2s ease;
    `;
    pronunciationButton.onmouseover = () => {
      pronunciationButton.style.background = 'rgba(255, 255, 255, 0.3)';
      pronunciationButton.style.transform = 'scale(1.1)';
    };
    pronunciationButton.onmouseout = () => {
      pronunciationButton.style.background = 'rgba(255, 255, 255, 0.2)';
      pronunciationButton.style.transform = 'scale(1)';
    };
    pronunciationButton.onclick = () => playPronunciation(selectedText, response);
    
    header.appendChild(pronunciationButton);
  }

  // Add to page
  document.body.appendChild(modal);

  // --- Event Listeners for Closing Modal ---
  const closeModal = () => {
    modal.remove();
    document.removeEventListener('keydown', escapeHandler);
  };
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeModal();
    }
  };

  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

/**
 * Parses and formats the raw LLM response into clean, structured DOM elements.
 * Converts basic Markdown (bold, italics) to DOM elements.
 * @param {string} response - The raw text response from the LLM.
 * @param {string} selectedWord - The word that was selected.
 * @returns {DocumentFragment} - The formatted DOM content.
 */
function formatLLMResponse(response, selectedWord) {
  const fragment = document.createDocumentFragment();
  
  // Handle the initial loading state
  if (response === "Loading explanation...") {
    const loadingDiv = createElement('div', {
      style: 'text-align: center; padding: 40px;'
    });
    
    const spinner = createElement('div', {
      style: 'display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #4CAF50; border-radius: 50%; animation: spin 1s linear infinite;'
    });
    
    const loadingText = createElement('p', {
      style: 'margin-top: 16px; color: #666;'
    }, 'Loading explanation...');
    
    // Add keyframes for spinner animation
    const style = createElement('style');
    style.textContent = '@keyframes spin { 100% { transform: rotate(360deg); } }';
    
    loadingDiv.appendChild(spinner);
    loadingDiv.appendChild(loadingText);
    fragment.appendChild(style);
    fragment.appendChild(loadingDiv);
    return fragment;
  }

  // Helper function to convert markdown text to DOM elements
  const convertMarkdownToDOM = (text) => {
    const span = document.createElement('span');
    
    // Handle bold text **text** -> <strong>
    let processedText = text.replace(/\*\*(.*?)\*\*/g, '<BOLD>$1</BOLD>');
    // Handle italic text *text* -> <em>
    processedText = processedText.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<ITALIC>$1</ITALIC>');
    
    // Split by our markers and create appropriate elements
    const parts = processedText.split(/(<BOLD>.*?<\/BOLD>|<ITALIC>.*?<\/ITALIC>)/);
    
    parts.forEach(part => {
      if (part.startsWith('<BOLD>')) {
        const strong = createElement('strong', {}, part.replace(/<\/?BOLD>/g, ''));
        span.appendChild(strong);
      } else if (part.startsWith('<ITALIC>')) {
        const em = createElement('em', {}, part.replace(/<\/?ITALIC>/g, ''));
        span.appendChild(em);
      } else if (part) {
        span.appendChild(document.createTextNode(part));
      }
    });
    
    return span;
  };

  // Define section headers
  const sectionHeaders = {
    'meaning': 'Meaning',
    'definition': 'Meaning',
    'respelling': 'Respelling (Simplified Phonetics)',
    'phonetics': 'Phonetics',
    'pronunciation': 'Respelling (Simplified Phonetics)',
    'noun': 'Noun',
    'verb': 'Verb',
    'adjective': 'Adjective',
    'adverb': 'Adverb',
    'pronoun': 'Pronoun',
    'preposition': 'Preposition',
    'conjunction': 'Conjunction',
    'interjection': 'Interjection',
    'determiner': 'Determiner',
    'article': 'Article',
    'etymology': 'Etymology',
    'origin': 'Etymology',
    'synonyms': 'Synonyms',
    'antonyms': 'Antonyms',
    'examples': 'Examples',
    'collocations': 'Collocations',
    'memory aid': 'Ways to remember its meaning',
    'ways to remember': 'Ways to remember its meaning',
    'memory': 'Ways to remember its meaning',
  };
  
  const headerRegex = new RegExp(`^\\*{0,2}(${Object.keys(sectionHeaders).join('|')})(?:\\s*\\(.*?\\))?:?\\*{0,2}$`, 'i');

  const lines = response.split('\n');
  const sections = {};
  let currentSectionKey = null;
  let hasFoundFirstHeader = false;
  let firstParagraphLines = [];

  // Parse lines into sections
  for (const rawLine of lines) {
    const cleanLine = rawLine.trim().replace(/^(?:\*{1,2}|-)\s*|\s*(?:\*{1,2})$/g, '').trim();
    if (!cleanLine) continue;

    const match = cleanLine.match(headerRegex);
    if (match) {
      hasFoundFirstHeader = true;
      currentSectionKey = match[1].toLowerCase();
      if (!sections[currentSectionKey]) {
        sections[currentSectionKey] = [];
      }
    } else if (currentSectionKey) {
      sections[currentSectionKey].push(rawLine.trim());
    } else if (!hasFoundFirstHeader && cleanLine.length > 0) {
      firstParagraphLines.push(rawLine.trim());
    }
  }

  // If we have content before first header, treat it as meaning
  if (firstParagraphLines.length > 0 && !sections['meaning'] && !sections['definition']) {
    sections['meaning'] = firstParagraphLines;
  }

  // Define the display order
  const displayOrder = [
    'meaning',
    'definition',
    'respelling',
    'phonetics',
    'pronunciation',
    'noun',
    'verb',
    'adjective',
    'adverb',
    'pronoun',
    'preposition',
    'conjunction',
    'interjection',
    'determiner',
    'article',
    'synonyms',
    'antonyms',
    'examples',
    'collocations',
    'etymology',
    'origin',
    'memory aid',
    'ways to remember',
    'memory'
  ];
  const processedKeys = new Set();

  // Generate DOM elements for each section
  for (const key of displayOrder) {
    if (processedKeys.has(key) || !sections[key]) continue;

    const displayTitle = sectionHeaders[key];

    // Determine if section should be rendered as a list
    const defaultListSections = ['synonyms', 'antonyms', 'examples', 'collocations'];
    const bulletRegex = /^[-*]\s+/;
    const numberRegex = /^\d+\.\s*/;
    let isList = defaultListSections.includes(key);
    let isNumberList = false;

    if (!isList) {
      const numberMatches = sections[key].filter(line => numberRegex.test(line.trim())).length;
      const bulletMatches = sections[key].filter(line => bulletRegex.test(line.trim())).length;
      if (numberMatches > 0 && numberMatches >= bulletMatches) {
        isList = true;
        isNumberList = true;
      } else if (bulletMatches > 0) {
        isList = true;
      }
    }

    // Create section header
    const header = createElement('h3', {
      style: 'font-size: 18px; font-weight: 600; color: #1a202c; margin-top: 24px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;'
    }, displayTitle);
    fragment.appendChild(header);

    if (isList) {
      const listTag = isNumberList ? 'ol' : 'ul';
      const listEl = createElement(listTag, {
        style: 'margin: 0 0 16px 0; padding-left: 20px; color: #4a5568;'
      });

      const items = [];
      let current = null;
      sections[key].forEach(line => {
        const trimmed = line.trim();
        if ((isNumberList && numberRegex.test(trimmed)) || (!isNumberList && bulletRegex.test(trimmed))) {
          if (current) items.push(current);
          current = trimmed.replace(bulletRegex, '').replace(numberRegex, '').trim();
        } else {
          if (current) {
            current += ' ' + trimmed;
          } else {
            current = trimmed;
          }
        }
      });
      if (current) items.push(current);

      items.forEach(text => {
        const li = createElement('li', {
          style: 'margin-bottom: 8px; line-height: 1.6; font-size: 16px; padding-left: 4px;'
        });
        li.appendChild(convertMarkdownToDOM(text));
        listEl.appendChild(li);
      });
      fragment.appendChild(listEl);
    } else {
      const p = createElement('p', {
        style: 'margin: 0 0 16px 0; color: #4a5568; line-height: 1.6; font-size: 16px;'
      });
      sections[key].forEach((line, idx) => {
        if (idx > 0) p.appendChild(createElement('br'));
        p.appendChild(convertMarkdownToDOM(line.trim()));
      });
      fragment.appendChild(p);
    }

    processedKeys.add(key);
  }

  // If no sections were parsed, create a simple paragraph
  if (fragment.children.length === 0) {
    const p = createElement('p', {
      style: 'margin: 0 0 16px 0; color: #4a5568; line-height: 1.6; font-size: 16px;'
    }, response);
    fragment.appendChild(p);
  }

  return fragment;
}


// Save word to list functionality
async function showSaveToListModal(word, explanation, context = null, provider = null) {
  // Remove any existing save modal
  const existingSaveModal = document.getElementById('smartdefine-save-modal');
  if (existingSaveModal) {
    existingSaveModal.remove();
  }

  // Get existing categories
  const storage = await browser.storage.local.get(['wordLists', 'learningSettings']);
  const wordLists = storage.wordLists || {};
  const categories = Object.keys(wordLists);

  // Create save modal
  const saveModal = document.createElement('div');
  saveModal.id = 'smartdefine-save-modal';
  saveModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 2147483648;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  const saveContent = document.createElement('div');
  saveContent.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 12px;
    width: 400px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Create save modal content safely using DOM methods
  const titleH3 = document.createElement('h3');
  titleH3.textContent = `Save "${word}" to Word List`;
  titleH3.style.cssText = 'margin: 0 0 20px 0; color: #333;';
  
  // Category selection div
  const categoryDiv = document.createElement('div');
  categoryDiv.style.cssText = 'margin-bottom: 15px;';
  const categoryLabel = document.createElement('label');
  categoryLabel.textContent = 'Select Category:';
  categoryLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: 500;';
  const categorySelect = document.createElement('select');
  categorySelect.id = 'category-select';
  categorySelect.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;';
  
  if (categories.length === 0) {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'No categories yet';
    categorySelect.appendChild(emptyOption);
  } else {
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categorySelect.appendChild(option);
    });
  }
  
  categoryDiv.appendChild(categoryLabel);
  categoryDiv.appendChild(categorySelect);
  
  // New category div
  const newCategoryDiv = document.createElement('div');
  newCategoryDiv.style.cssText = 'margin-bottom: 20px;';
  const newCategoryLabel = document.createElement('label');
  newCategoryLabel.textContent = 'Or create new category:';
  newCategoryLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: 500;';
  const newCategoryInput = document.createElement('input');
  newCategoryInput.type = 'text';
  newCategoryInput.id = 'new-category';
  newCategoryInput.placeholder = 'Enter new category name';
  newCategoryInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;';
  
  newCategoryDiv.appendChild(newCategoryLabel);
  newCategoryDiv.appendChild(newCategoryInput);
  
  // Notes div
  const notesDiv = document.createElement('div');
  notesDiv.style.cssText = 'margin-bottom: 20px;';
  const notesLabel = document.createElement('label');
  notesLabel.textContent = 'Personal Notes (optional):';
  notesLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: 500;';
  const notesTextarea = document.createElement('textarea');
  notesTextarea.id = 'personal-notes';
  notesTextarea.placeholder = 'Add your own notes about this word...';
  notesTextarea.style.cssText = 'width: 100%; height: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; box-sizing: border-box;';
  
  notesDiv.appendChild(notesLabel);
  notesDiv.appendChild(notesTextarea);
  
  // Buttons div
  const buttonsDiv = document.createElement('div');
  buttonsDiv.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
  const cancelButton = document.createElement('button');
  cancelButton.id = 'cancel-save';
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = 'padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;';
  const confirmButton = document.createElement('button');
  confirmButton.id = 'confirm-save';
  confirmButton.textContent = 'Save Word';
  confirmButton.style.cssText = 'padding: 10px 20px; border: none; background: #4CAF50; color: white; border-radius: 4px; cursor: pointer;';
  
  buttonsDiv.appendChild(cancelButton);
  buttonsDiv.appendChild(confirmButton);
  
  // Assemble all elements
  saveContent.appendChild(titleH3);
  saveContent.appendChild(categoryDiv);
  saveContent.appendChild(newCategoryDiv);
  saveContent.appendChild(notesDiv);
  saveContent.appendChild(buttonsDiv);

  saveModal.appendChild(saveContent);
  document.body.appendChild(saveModal);

  // Event handlers
  document.getElementById('cancel-save').onclick = () => saveModal.remove();
  document.getElementById('confirm-save').onclick = async () => {
    const categorySelect = document.getElementById('category-select');
    const newCategoryInput = document.getElementById('new-category');
    const notesInput = document.getElementById('personal-notes');
    
    let selectedCategory = newCategoryInput.value.trim() || categorySelect.value;
    
    if (!selectedCategory) {
      selectedCategory = 'General';
    }
    
    await saveWordToList(word, explanation, selectedCategory, notesInput.value.trim(), context, provider);
    saveModal.remove();
    
    // Show success message
    showTemporaryMessage('Word saved successfully!', 'success');
  };

  // Close on outside click
  saveModal.onclick = (e) => {
    if (e.target === saveModal) {
      saveModal.remove();
    }
  };
}

// Save word to storage
async function saveWordToList(word, explanation, category, notes, context = null, provider = null) {
  const storage = await browser.storage.local.get(['wordLists']);
  const wordLists = storage.wordLists || {};
  
  if (!wordLists[category]) {
    wordLists[category] = [];
  }
  
  const formInfo = await getWordFormInfo(word);
  const baseWord = formInfo.base;

  const finalExplanation = await addWordInfoToExplanation(word, explanation);

  // Check if word already exists in this category with same provider
  const existingIndex = wordLists[category].findIndex(item =>
    item.word.toLowerCase() === baseWord.toLowerCase() && item.provider === provider);
  
  const wordId = existingIndex >= 0
    ? wordLists[category][existingIndex].id
    : (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  const wordData = {
    id: wordId,
    word: baseWord,
    originalForm: word,
    provider: provider,
    status: existingIndex >= 0 ? 'updated' : 'new',
    explanation: finalExplanation,
    notes: notes,
    context: context, // Store context information
    dateAdded: new Date().toISOString(),
    reviewCount: 0,
    lastReviewed: null,
    difficulty: 'new', // new, learning, mastered
    nextReview: new Date().toISOString(), // Make immediately available for review
    easeFactor: 2.5, // Initial ease factor for spaced repetition
    interval: 1 // Initial interval
  };
  
  if (existingIndex >= 0) {
    // Update existing word
    wordLists[category][existingIndex] = { ...wordLists[category][existingIndex], ...wordData, dateAdded: wordLists[category][existingIndex].dateAdded };
  } else {
    // Add new word
    wordLists[category].push(wordData);
  }
  
  await browser.storage.local.set({ wordLists });
}

// Show temporary message
function showTemporaryMessage(message, type = 'success') {
  const msgDiv = document.createElement('div');
  msgDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#4CAF50' : '#f44336'};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 2147483649;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: slideInRight 0.3s ease-out;
  `;
  msgDiv.textContent = message;
  
  // Add animation styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(styleSheet);
  
  document.body.appendChild(msgDiv);
  
  setTimeout(() => {
    msgDiv.remove();
    styleSheet.remove();
  }, 3000);
}

// Extract context around selected text for better definitions
function extractContext(selectedText) {
  try {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    
    // Get the text content of the parent element or document
    let contextElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    
    // Try to find a meaningful parent (paragraph, div, article, etc.)
    while (contextElement && contextElement !== document.body) {
      const tagName = contextElement.tagName?.toLowerCase();
      if (['p', 'div', 'article', 'section', 'main', 'td', 'li'].includes(tagName)) {
        break;
      }
      contextElement = contextElement.parentElement;
    }
    
    if (!contextElement) return null;
    
    // Get the full text content
    const fullText = contextElement.textContent || '';
    const selectedIndex = fullText.toLowerCase().indexOf(selectedText.toLowerCase());
    
    if (selectedIndex === -1) return null;
    
    // Extract context: 150 characters before and after the selected text
    const contextBefore = fullText.substring(Math.max(0, selectedIndex - 150), selectedIndex).trim();
    const contextAfter = fullText.substring(selectedIndex + selectedText.length, selectedIndex + selectedText.length + 150).trim();
    
    // Only return context if we have meaningful surrounding text
    if (contextBefore.length < 10 && contextAfter.length < 10) return null;
    
    return {
      before: contextBefore,
      after: contextAfter,
      fullSentence: extractSentence(fullText, selectedIndex, selectedText.length)
    };
  } catch (error) {
    console.warn('Could not extract context:', error);
    return null;
  }
}

// Extract the full sentence containing the selected text
function extractSentence(text, selectedIndex, selectedLength) {
  try {
    // Find sentence boundaries (. ! ? followed by space or end)
    const sentenceEndBefore = text.lastIndexOf('.', selectedIndex);
    const exclamationBefore = text.lastIndexOf('!', selectedIndex);
    const questionBefore = text.lastIndexOf('?', selectedIndex);
    
    const sentenceStart = Math.max(
      sentenceEndBefore !== -1 ? sentenceEndBefore + 1 : 0,
      exclamationBefore !== -1 ? exclamationBefore + 1 : 0,
      questionBefore !== -1 ? questionBefore + 1 : 0,
      0
    );
    
    const afterSelectedText = selectedIndex + selectedLength;
    const sentenceEndAfter = text.indexOf('.', afterSelectedText);
    const exclamationAfter = text.indexOf('!', afterSelectedText);
    const questionAfter = text.indexOf('?', afterSelectedText);
    
    let sentenceEnd = text.length;
    [sentenceEndAfter, exclamationAfter, questionAfter].forEach(pos => {
      if (pos !== -1 && pos < sentenceEnd) {
        sentenceEnd = pos + 1;
      }
    });
    
    const sentence = text.substring(sentenceStart, sentenceEnd).trim();
    return sentence.length > 10 ? sentence : null;
  } catch (error) {
    return null;
  }
}

// Content script loaded
console.log('SmartDefine content script loaded on:', window.location.href);

// Add a visual indicator that content script is loaded (for debugging)
const debugIndicator = document.createElement('div');
debugIndicator.id = 'smartdefine-debug-indicator';
debugIndicator.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  width: 10px;
  height: 10px;
  background: green;
  border-radius: 50%;
  z-index: 999999;
  pointer-events: none;
`;
debugIndicator.title = 'SmartDefine content script loaded';
document.body?.appendChild(debugIndicator);

// Remove the indicator after 3 seconds
setTimeout(() => {
  debugIndicator?.remove();
}, 3000);

// Listen for messages from background script
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.command === "explainSelectedText") {
    const selectedText = message.text;
    
    // Get settings from storage
    const settings = await browser.storage.local.get(["selectedProvider", "prompt", "providers", "learningSettings"]);
    
    // Debug logging to understand the issue
    console.log('Settings loaded:', {
      selectedProvider: settings.selectedProvider,
      hasProviders: !!settings.providers,
      providers: settings.providers
    });
    
    const hasAPIKey = Object.values(settings.providers || {}).some(p => p.enabled && p.apiKey && p.apiKey.trim().length > 0);
    
    console.log('API Key check result:', hasAPIKey);
    
    // Show loading message immediately only if we have an API key
    if (hasAPIKey) {
      createResponseModal(selectedText, "Loading explanation...");
    }

    try {
      if (hasAPIKey) {
        // Extract context around the selected text only if enabled
        const learningSettings = settings.learningSettings || {};
        const context = learningSettings.contextAwareDefinitions ? extractContext(selectedText) : null;

        // Build prompt for logging
        let finalPrompt = (settings.prompt || '').replace(/X_WORD_X/g, selectedText);
        if (context) {
          let contextInfo = "\n\nCONTEXT INFORMATION:";
          if (context.fullSentence) {
            contextInfo += `\nThe word appears in this sentence: "${context.fullSentence}"`;
          }
          if (context.before && context.after) {
            contextInfo += `\nSurrounding text: "...${context.before} [${selectedText}] ${context.after}..."`;
          }
          contextInfo += "\n\nPlease provide a definition that is appropriate for this specific context. Consider how the word is being used in this particular situation.";
          finalPrompt += contextInfo;
        }
        console.log('LLM Prompt:', finalPrompt);

        // Send request to background script to call LLM API with context (already has fallback)
        const response = await browser.runtime.sendMessage({
          command: "callLLMAPI",
          text: selectedText,
          context: context,
          settings: settings
        });

        if (response && typeof response === 'object') {
          console.log('LLM Response from', response.provider + ':', response.text);
          createResponseModal(selectedText, response.text, context, response.provider);
        } else {
          console.log('LLM Response:', response);
          createResponseModal(selectedText, response, context, null);
        }
      } else {
        // No API key configured, directly use free dictionary API
        console.log('No API key found, using free dictionary service');
        
        // Show loading message for dictionary lookup
        createResponseModal(selectedText, "Loading definition from dictionary...", null, 'FreeDictionary');
        
        try {
          const dictionaryResponse = await browser.runtime.sendMessage({
            command: 'callFreeDictionaryAPI',
            text: selectedText
          });

          console.log('Dictionary Response:', dictionaryResponse);

          // Update modal with dictionary response
          createResponseModal(selectedText, dictionaryResponse, null, 'FreeDictionary');
        } catch (dictError) {
          console.error('Dictionary API failed:', dictError);
          const errorMessage = `Unable to get definition for "${selectedText}". Dictionary service is unavailable. Please check your internet connection or configure an LLM API key for enhanced explanations.`;
          createResponseModal(selectedText, errorMessage, null, 'FreeDictionary');
        }
        return; // Exit early to prevent error handling
      }
    } catch (error) {
      console.error('Error getting explanation:', error);
      
      // Show fallback status message
      updateModalWithStatus(selectedText, 'Trying backup dictionary service...', 'info');
      
      try {
        // Fallback to free dictionary API
        console.log('LLM API failed, trying free dictionary fallback');
        const fallbackResponse = await browser.runtime.sendMessage({
          command: 'callFreeDictionaryAPI',
          text: selectedText
        });

        console.log('Dictionary Response:', fallbackResponse);

        // Update modal with dictionary response
        createResponseModal(selectedText, fallbackResponse, null, 'FreeDictionary');
      } catch (dictError) {
        console.error('Both LLM and dictionary APIs failed:', dictError);
        const errorMessage = `Unable to get explanation for "${selectedText}". Both AI service and dictionary lookup failed. Please check your internet connection or try again later.`;
        createResponseModal(selectedText, errorMessage, null, 'FreeDictionary');
      }
    }
    
    // Send response back to background script
    sendResponse({ success: true });
  }
  
  // Return true to indicate we will respond asynchronously
  return true;
});

// Export Modal Function
function showExportModal(selectedText, response) {
  // Remove any existing export modal
  const existingExportModal = document.getElementById('smartdefine-export-modal');
  if (existingExportModal) {
    existingExportModal.remove();
  }

  // Create export modal
  const exportModal = document.createElement('div');
  exportModal.id = 'smartdefine-export-modal';
  exportModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    z-index: 2147483648;
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.3s ease-out;
  `;

  const exportContent = document.createElement('div');
  exportContent.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 16px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: slideIn 0.3s ease-out;
  `;

  const exportTitle = document.createElement('h3');
  exportTitle.textContent = `Export "${selectedText}"`;
  exportTitle.style.cssText = `
    margin: 0 0 20px 0;
    font-size: 20px;
    color: #333;
    text-align: center;
  `;

  const exportOptions = document.createElement('div');
  exportOptions.style.cssText = `
    display: grid;
    gap: 15px;
    margin-bottom: 20px;
  `;

  // Create export format buttons
  const formats = [
    { id: 'txt', name: 'TXT File', icon: '📄', description: 'Plain text format' },
    { id: 'pdf', name: 'PDF File', icon: '📕', description: 'HTML template for PDF printing' },
    { id: 'flashcard', name: 'Flashcard', icon: '🃏', description: 'Printable flashcard HTML' }
  ];

  formats.forEach(format => {
    const formatButton = document.createElement('button');
    formatButton.style.cssText = `
      padding: 15px 20px;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      background: white;
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 15px;
      font-size: 16px;
    `;

    // Create button content safely
    const iconSpan = document.createElement('span');
    iconSpan.style.fontSize = '24px';
    iconSpan.textContent = format.icon;
    
    const contentDiv = document.createElement('div');
    const nameDiv = document.createElement('div');
    nameDiv.style.cssText = 'font-weight: 600; color: #333;';
    nameDiv.textContent = format.name;
    const descDiv = document.createElement('div');
    descDiv.style.cssText = 'font-size: 14px; color: #666;';
    descDiv.textContent = format.description;
    
    contentDiv.appendChild(nameDiv);
    contentDiv.appendChild(descDiv);
    formatButton.appendChild(iconSpan);
    formatButton.appendChild(contentDiv);

    formatButton.onmouseover = () => {
      formatButton.style.borderColor = '#2196F3';
      formatButton.style.background = '#f8f9ff';
    };
    formatButton.onmouseout = () => {
      formatButton.style.borderColor = '#e0e0e0';
      formatButton.style.background = 'white';
    };

    if (format.id === 'txt') {
      formatButton.onclick = () => {
        exportToTXT(selectedText, response);
        exportModal.remove();
      };
    } else if (format.id === 'pdf') {
      formatButton.onclick = () => {
        exportToPDFContent(selectedText, response);
        exportModal.remove();
      };
    } else if (format.id === 'flashcard') {
      formatButton.onclick = () => {
        exportToFlashcard(selectedText, response);
        exportModal.remove();
      };
    } else {
      formatButton.onclick = () => {
        showMessage('This export format is coming soon!', 'info');
      };
      formatButton.style.opacity = '0.6';
      formatButton.style.cursor = 'not-allowed';
    }

    exportOptions.appendChild(formatButton);
  });

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #f8f9fa;
    color: #666;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.3s ease;
  `;
  cancelButton.onmouseover = () => {
    cancelButton.style.background = '#e9ecef';
  };
  cancelButton.onmouseout = () => {
    cancelButton.style.background = '#f8f9fa';
  };
  cancelButton.onclick = () => exportModal.remove();

  exportContent.appendChild(exportTitle);
  exportContent.appendChild(exportOptions);
  exportContent.appendChild(cancelButton);
  exportModal.appendChild(exportContent);
  document.body.appendChild(exportModal);

  // Close on outside click
  exportModal.onclick = (e) => {
    if (e.target === exportModal) {
      exportModal.remove();
    }
  };

  // Close on escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      exportModal.remove();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

// Export to TXT function
async function exportToTXT(selectedText, response) {
  const prepared = await addWordInfoToExplanation(selectedText, response);
  const content = `${selectedText}\n\n${cleanMarkdownText(prepared)}\n\nExported from SmartDefine Extension\nDate: ${new Date().toLocaleDateString()}`;
  downloadFile(content, `${selectedText}.txt`, 'text/plain');
  showMessage(`"${selectedText}" exported to TXT!`, 'success');
}

// Export to PDF function (downloads HTML file for printing to PDF)
async function exportToPDFContent(selectedText, response) {
  try {
    const htmlContent = await generateSingleWordPDFContent(selectedText, response);
    const filename = `${selectedText}_SmartDefine.html`;
    
    // Download as HTML file that can be opened and printed to PDF
    downloadFile(htmlContent, filename, 'text/html');
    showMessage(`📄 PDF template downloaded! Open "${filename}" in your browser and press Ctrl+P (Cmd+P on Mac) to save as PDF.`, 'success');
    
  } catch (error) {
    console.error('PDF export error:', error);
    showMessage('PDF export failed. Please try again.', 'error');
  }
}


// Export to Flashcard function - downloads HTML file for viewing and printing
function exportToFlashcard(selectedText, response) {
  try {
    const flashcardContent = generateFlashcardHTML(selectedText, response);
    const filename = `${selectedText}_Flashcard.html`;
    
    // Download as HTML file that can be opened for viewing and printing
    downloadFile(flashcardContent, filename, 'text/html');
    showMessage(`🃏 Flashcard downloaded! Open "${filename}" in your browser to view and print your flashcard.`, 'success');
    
  } catch (error) {
    console.error('Flashcard export error:', error);
    showMessage('Flashcard export failed. Please try again.', 'error');
  }
}

// Helper function to escape HTML characters
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Generate PDF content for single word
async function generateSingleWordPDFContent(selectedText, response) {
  try {
    const prepared = await addWordInfoToExplanation(selectedText, response);
    const cleanResponse = cleanMarkdownText(prepared) || 'No explanation available';
    const safeSelectedText = escapeHtml(selectedText);
    const safeCleanResponse = escapeHtml(cleanResponse);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeSelectedText} - SmartDefine</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
      .no-print { display: none; }
    }
    @media screen {
      body { margin: 20px; }
    }
    body { 
      font-family: Arial, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      max-width: 700px; 
      margin: 0 auto; 
      padding: 20px;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px; 
      border-bottom: 2px solid #2196F3; 
      padding-bottom: 15px; 
    }
    .word-title { 
      font-size: 36px; 
      font-weight: bold; 
      color: #2196F3; 
      margin: 0; 
    }
    .explanation { 
      margin: 20px 0; 
      padding: 20px; 
      border: 1px solid #ddd; 
      border-radius: 8px; 
      background: #fff;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .footer { 
      text-align: center; 
      margin-top: 40px; 
      font-size: 12px; 
      color: #999; 
      border-top: 1px solid #eee;
      padding-top: 15px;
    }
    .print-button {
      background: #2196F3;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      margin: 20px auto;
      display: block;
    }
  </style>
</head>
<body>
  <button id="printToPdfBtn" class="print-button no-print">🖨️ Print to PDF</button>
  
  <div class="header">
    <div class="word-title">${safeSelectedText}</div>
  </div>
  
  <div class="explanation">
${safeCleanResponse}
  </div>
  
  <div class="footer">
    Generated by SmartDefine Browser Extension on ${new Date().toLocaleDateString()}
  </div>
  
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const printBtn = document.getElementById('printToPdfBtn');
      if (printBtn) {
        printBtn.addEventListener('click', () => {
          window.print();
        });
      }
    });
  </script>
</body>
</html>`;
  } catch (error) {
    console.error('Error generating PDF content:', error);
    return `<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Error generating PDF content</h1><p>${error.message}</p></body></html>`;
  }
}

// Generate flashcard HTML
function generateFlashcardHTML(selectedText, response) {
  try {
    const meaning = extractSimpleMeaning(response) || 'Definition';
    const cleanResponse = cleanMarkdownText(response) || 'No explanation available';
    const safeSelectedText = escapeHtml(selectedText);
    const safeMeaning = escapeHtml(meaning);
    const safeCleanResponse = escapeHtml(cleanResponse);
    
    // Truncate explanation for flashcard
    const truncatedExplanation = safeCleanResponse.length > 200 
      ? safeCleanResponse.substring(0, 200) + '...' 
      : safeCleanResponse;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flashcard: ${safeSelectedText}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .flashcard { page-break-after: always; }
      .no-print { display: none; }
    }
    @media screen {
      body { margin: 20px; }
    }
    body { 
      font-family: Arial, sans-serif; 
      margin: 0; 
      padding: 20px; 
      background: #f5f5f5;
    }
    .print-button {
      background: #2196F3;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      margin: 20px auto;
      display: block;
    }
    .instructions {
      text-align: center;
      margin: 20px 0;
      padding: 15px;
      background: #e3f2fd;
      border-radius: 8px;
      color: #1976d2;
    }
    .flashcard { 
      width: 3.5in; 
      height: 2.5in; 
      border: 2px solid #333; 
      border-radius: 8px; 
      margin: 20px auto; 
      padding: 15px; 
      display: flex; 
      flex-direction: column; 
      justify-content: center; 
      text-align: center; 
      box-sizing: border-box;
      background: white;
      position: relative;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .front .word { 
      font-size: 28px; 
      font-weight: bold; 
      color: #2196F3; 
      margin-bottom: 10px; 
      word-wrap: break-word;
    }
    .front .category {
      font-size: 14px;
      color: #666;
      margin-top: 10px;
    }
    .back .meaning { 
      font-size: 16px; 
      font-weight: bold; 
      margin-bottom: 12px; 
      color: #333;
      word-wrap: break-word;
    }
    .back .explanation { 
      font-size: 12px; 
      line-height: 1.4; 
      color: #555;
      word-wrap: break-word;
      overflow: hidden;
    }
    .label { 
      position: absolute; 
      top: 8px; 
      left: 8px; 
      font-size: 10px; 
      color: #999; 
      font-weight: bold;
    }
    .footer-instructions {
      text-align: center; 
      margin-top: 30px; 
      font-size: 12px; 
      color: #666;
      padding: 15px;
      background: #fff;
      border-radius: 8px;
      border: 1px dashed #ccc;
    }
  </style>
</head>
<body>
  <button id="printFlashcardsBtn" class="print-button no-print">🖨️ Print Flashcards</button>
  
  <div class="instructions no-print">
    <strong>📋 Instructions:</strong> Print this page, then cut along the borders and fold to create double-sided flashcards
  </div>
  
  <!-- Front of flashcard -->
  <div class="flashcard front">
    <div class="label">FRONT</div>
    <div class="word">${safeSelectedText}</div>
    <div class="category">Word to Learn</div>
  </div>
  
  <!-- Back of flashcard -->
  <div class="flashcard back">
    <div class="label">BACK</div>
    <div class="meaning">${safeMeaning}</div>
    <div class="explanation">${truncatedExplanation}</div>
  </div>
  
  <div class="footer-instructions">
    <strong>💡 How to use:</strong><br>
    1. Cut out each flashcard along the border<br>
    2. Fold the front and back together<br>
    3. Test yourself by reading the word and trying to recall the definition<br>
    4. Check your answer by flipping to the back
  </div>
  
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const printBtn = document.getElementById('printFlashcardsBtn');
      if (printBtn) {
        printBtn.addEventListener('click', () => {
          window.print();
        });
      }
    });
  </script>
</body>
</html>`;
  } catch (error) {
    console.error('Error generating flashcard content:', error);
    return `<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Error generating flashcard content</h1><p>${error.message}</p></body></html>`;
  }
}

// Clean markdown text for readable output
function cleanMarkdownText(text) {
  return text
    // Remove markdown headers
    .replace(/#{1,6}\s*/g, '')
    // Remove markdown bold
    .replace(/\*\*(.*?)\*\*/g, '$1')
    // Remove markdown italic
    .replace(/\*(.*?)\*/g, '$1')
    // Remove markdown list markers
    .replace(/^[-*+]\s+/gm, '• ')
    // Clean up extra whitespace
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

// Extract simple meaning from response
function extractSimpleMeaning(response) {
  const cleanText = cleanMarkdownText(response);
  const lines = cleanText.split('\n');
  
  // Look for meaning section
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

// Download file helper
function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Message display function
function showMessage(message, type = 'info') {
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 2147483649;
    animation: slideIn 0.3s ease-out;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  `;
  messageDiv.textContent = message;
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 3000);
}

// Audio pronunciation function - using the same system as Word List View
async function playPronunciation(word, response) {
  try {
    const audioPlayed = await tryMerriamWebsterAudio(word);
    if (audioPlayed) return;
    playWebSpeechPronunciation(word, response);
  } catch (error) {
    playWebSpeechPronunciation(word, response);
  }
}

async function tryMerriamWebsterAudio(word) {
  try {
    const response = await fetch(`https://www.dictionaryapi.com/api/v3/references/collegiate/json/${word}?key=your-api-key`);
    // This would need a real API key to work
    return false; // Fallback for now
  } catch (error) {
    return false;
  }
}

function playWebSpeechPronunciation(word, response) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = 0.8;
    utterance.pitch = 1;
    utterance.volume = 1;
    speechSynthesis.speak(utterance);
  }
}




// Show loading message
function showLoadingMessage(message) {
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'smartdefine-loading';
  loadingDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #2196F3;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
    animation: slideInRight 0.3s ease-out;
  `;
  loadingDiv.textContent = message;
  document.body.appendChild(loadingDiv);
}

// Hide loading message
function hideLoadingMessage() {
  const loadingDiv = document.getElementById('smartdefine-loading');
  if (loadingDiv) {
    loadingDiv.remove();
  }
}

// Show error message
function showErrorMessage(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #f44336;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
    animation: slideInRight 0.3s ease-out;
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

// Update existing modal with status message (creates a nice in-modal status update)
function updateModalWithStatus(selectedText, statusMessage, type = 'info') {
  const existingModal = document.getElementById('smartdefine-modal');
  if (!existingModal) {
    // If no modal exists, create one with the status
    createResponseModal(selectedText, generateStatusHTML(statusMessage, type));
    return;
  }

  // Find the content area and update it
  const contentArea = existingModal.querySelector('.smartdefine-content-area');
  if (contentArea) {
    safeSetHTML(contentArea, generateStatusHTML(statusMessage, type));
  }
}

// Generate status HTML with proper styling and animations
function generateStatusHTML(message, type = 'info') {
  const icons = {
    info: '🔄',
    success: '✅', 
    warning: '⚠️',
    error: '❌'
  };

  const colors = {
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FF9800', 
    error: '#f44336'
  };

  return `
    <div style="text-align: center; padding: 40px;">
      <div style="display: inline-block; position: relative; margin-bottom: 20px;">
        <div style="
          width: 60px; 
          height: 60px; 
          border: 4px solid #f3f3f3; 
          border-top: 4px solid ${colors[type]}; 
          border-radius: 50%; 
          animation: spin 1s linear infinite;
          margin: 0 auto;
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 24px;
        ">${icons[type]}</div>
      </div>
      
      <p style="
        margin: 0;
        color: ${colors[type]};
        font-size: 16px;
        font-weight: 500;
        line-height: 1.5;
      ">${message}</p>
      
      <div style="
        margin-top: 12px;
        font-size: 14px;
        color: #666;
        opacity: 0.8;
      ">Please wait...</div>
      
      <style>
        @keyframes spin { 
          100% { transform: rotate(360deg); } 
        }
      </style>
    </div>
  `;
}
