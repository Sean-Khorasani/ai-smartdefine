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

// ===== INTELLIGENT WORD EXTRACTION =====
// Extracts the first valid word from multi-word selections or messy text

async function extractFirstValidWord(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    console.warn('⚠️ Invalid input to extractFirstValidWord:', rawText);
    return 'word'; // Only use 'word' for truly invalid input
  }
  
  
  // Step 1: Basic cleaning - remove extra whitespace, normalize
  let cleaned = rawText.trim().replace(/\s+/g, ' ');
  
  // Step 2: Handle common selection artifacts and punctuation
  // Remove leading/trailing punctuation but preserve apostrophes within words
  cleaned = cleaned.replace(/^[^\w']+|[^\w']+$/g, '');
  
  // Step 3: Split into potential words and validate each with APIs
  const words = cleaned.split(/\s+/);
  
  for (const word of words) {
    const validWord = extractValidWordFromToken(word);
    if (validWord && validWord.length >= 2) {
      const isValid = await isActualEnglishWord(validWord);
      if (isValid) {
        return validWord;
      } else {
      }
    }
  }
  
  // Step 4: Fallback extraction with API validation
  const allMatches = rawText.match(/[a-zA-Z']+/g) || [];
  
  for (const match of allMatches) {
    if (match.length >= 2) {
      const extracted = extractValidWordFromToken(match);
      if (extracted) {
        const isValid = await isActualEnglishWord(extracted);
        if (isValid) {
          return extracted;
        }
      }
    }
  }
  
  console.warn('⚠️ No valid English word found in any dictionaries, using original text');
  // Return the original cleaned text instead of generic "word"
  const firstWord = rawText.trim().split(/\s+/)[0];
  const cleanedFirstWord = firstWord.replace(/^[^\w']+|[^\w']+$/g, '');
  return cleanedFirstWord || rawText.trim(); // Ultimate fallback to original text
}

function extractValidWordFromToken(token) {
  if (!token) return null;
  
  
  // Clean the token
  let word = token.toLowerCase().trim();
  
  // Remove leading/trailing non-alphabetic characters except apostrophes
  word = word.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, '');
  
  // Handle possessive forms and contractions intelligently
  if (word.includes("'")) {
    
    // Handle possessives: "extension's" → "extension"
    if (word.endsWith("'s") || word.endsWith("'")) {
      const baseWord = word.replace(/'s?$/, '');
      if (baseWord.length >= 2) {
        return baseWord;
      }
    }
    
    // Handle contractions: take the first valid part
    // "don't" → "don", "it's" → "it", "we're" → "we"
    const parts = word.split("'");
    for (const part of parts) {
      if (part.length >= 2 && /^[a-zA-Z]+$/.test(part)) {
        return part;
      }
    }
  }
  
  // Validate the word contains only letters (and is meaningful)
  if (word.length >= 2 && /^[a-zA-Z]+$/.test(word)) {
    // Additional filtering for common non-words
    const skipWords = ['a', 'an', 'the', 'of', 'to', 'in', 'for', 'on', 'at', 'by', 'as', 'is', 'be', 'or', 'and', 'but', 'if', 'so', 'no', 'my', 'me', 'we', 'he', 'she', 'it', 'us', 'up', 'do', 'go'];
    if (!skipWords.includes(word) || word.length > 3) {
      return word;
    }
  }
  
  return null;
}

// API-First Word Validation - Uses online dictionary services for accurate validation
async function isActualEnglishWord(word) {
  if (!word || word.length < 2) return false;
  
  const lowerWord = word.toLowerCase();
  
  // Step 1: Try Free Dictionary API (fast and free)
  try {
    const isValid = await validateWordWithFreeDictionary(lowerWord);
    if (isValid !== null) {
      console.log(`📚 Dictionary API result for "${lowerWord}":`, isValid);
      return isValid;
    }
  } catch (error) {
  }
  
  // Step 2: Try Wiktionary API (more comprehensive)  
  try {
    const isValid = await validateWordWithWiktionary(lowerWord);
    if (isValid !== null) {
      console.log(`📖 Wiktionary API result for "${lowerWord}":`, isValid);
      return isValid;
    }
  } catch (error) {
  }
  
  // Step 3: Minimal local fallback (only for very common words and basic patterns)
  console.log(`🔧 Using minimal local fallback for "${lowerWord}"`);
  return hasMinimalValidPattern(lowerWord);
}

// Validate word using Free Dictionary API
async function validateWordWithFreeDictionary(word) {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      // If we get a valid response with definitions, the word exists
      return Array.isArray(data) && data.length > 0 && data[0].meanings && data[0].meanings.length > 0;
    } else if (response.status === 404) {
      // 404 means word not found
      return false;
    } else {
      // Other errors - return null to try next method
      return null;
    }
  } catch (error) {
    // Network or other errors - return null to try next method
    return null;
  }
}

// Validate word using Wiktionary API
async function validateWordWithWiktionary(word) {
  try {
    const response = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${word}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SmartDefine Extension (https://github.com/user/smartdefine)'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      // If we get definitions, the word exists
      return data && Object.keys(data).length > 0;
    } else if (response.status === 404) {
      // 404 means word not found
      return false;
    } else {
      // Other errors - return null to try next method
      return null;
    }
  } catch (error) {
    // Network or other errors - return null to try next method
    return null;
  }
}

// Minimal local validation (only basic patterns and very common words when APIs fail)
function hasMinimalValidPattern(word) {
  // Only validate very basic patterns when APIs fail
  if (word.length < 2) return false;
  
  // Super basic check - contains at least one vowel (except very short words)
  const hasVowel = /[aeiou]/.test(word);
  if (!hasVowel && word.length > 3) return false;
  
  // Reject obvious non-words
  if (/^[qxz]/.test(word) && word.length < 4) return false;
  
  // Very basic common word list (only most essential words for fallback)
  const essentialWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'man', 'men', 'run', 'too', 'use', 'got', 'let', 'put', 'say', 'she', 'try', 'ask', 'car', 'dog', 'eat', 'end', 'far', 'fix', 'fun', 'gun', 'job', 'joy', 'key', 'lay', 'lot', 'map', 'mom', 'pay', 'red', 'sea', 'sit', 'sun', 'ten', 'top', 'war', 'win', 'yes', 'yet', 'zip',
    'configure', 'required', 'sufficient', 'different', 'important', 'extension', 'application', 'computer', 'system'
  ]);
  
  if (essentialWords.has(word)) return true;
  
  // For longer words, be more permissive with basic patterns
  if (word.length >= 4) {
    // Common English suffixes suggest real words
    const commonSuffixes = ['ing', 'ed', 'er', 'est', 'ly', 'tion', 'sion', 'ness', 'ment', 'able', 'ible', 'ful', 'less'];
    return commonSuffixes.some(suffix => word.endsWith(suffix));
  }
  
  // For short words, be more restrictive
  return false;
}

// Removed obsolete functions - now using API-first validation

// ===== COMPREHENSIVE IRREGULAR WORD DICTIONARIES =====
// This comprehensive database handles irregular word forms that can't be detected algorithmically

const irregularWords = {
  // Irregular verbs with all forms
  verbs: {
    'run': { base: 'run', past: 'ran', pastParticiple: 'run', presentParticiple: 'running', thirdPerson: 'runs' },
    'go': { base: 'go', past: 'went', pastParticiple: 'gone', presentParticiple: 'going', thirdPerson: 'goes' },
    'see': { base: 'see', past: 'saw', pastParticiple: 'seen', presentParticiple: 'seeing', thirdPerson: 'sees' },
    'come': { base: 'come', past: 'came', pastParticiple: 'come', presentParticiple: 'coming', thirdPerson: 'comes' },
    'take': { base: 'take', past: 'took', pastParticiple: 'taken', presentParticiple: 'taking', thirdPerson: 'takes' },
    'get': { base: 'get', past: 'got', pastParticiple: 'gotten', presentParticiple: 'getting', thirdPerson: 'gets' },
    'make': { base: 'make', past: 'made', pastParticiple: 'made', presentParticiple: 'making', thirdPerson: 'makes' },
    'give': { base: 'give', past: 'gave', pastParticiple: 'given', presentParticiple: 'giving', thirdPerson: 'gives' },
    'think': { base: 'think', past: 'thought', pastParticiple: 'thought', presentParticiple: 'thinking', thirdPerson: 'thinks' },
    'say': { base: 'say', past: 'said', pastParticiple: 'said', presentParticiple: 'saying', thirdPerson: 'says' },
    'know': { base: 'know', past: 'knew', pastParticiple: 'known', presentParticiple: 'knowing', thirdPerson: 'knows' },
    'find': { base: 'find', past: 'found', pastParticiple: 'found', presentParticiple: 'finding', thirdPerson: 'finds' },
    'tell': { base: 'tell', past: 'told', pastParticiple: 'told', presentParticiple: 'telling', thirdPerson: 'tells' },
    'feel': { base: 'feel', past: 'felt', pastParticiple: 'felt', presentParticiple: 'feeling', thirdPerson: 'feels' },
    'become': { base: 'become', past: 'became', pastParticiple: 'become', presentParticiple: 'becoming', thirdPerson: 'becomes' },
    'leave': { base: 'leave', past: 'left', pastParticiple: 'left', presentParticiple: 'leaving', thirdPerson: 'leaves' },
    'put': { base: 'put', past: 'put', pastParticiple: 'put', presentParticiple: 'putting', thirdPerson: 'puts' },
    'mean': { base: 'mean', past: 'meant', pastParticiple: 'meant', presentParticiple: 'meaning', thirdPerson: 'means' },
    'keep': { base: 'keep', past: 'kept', pastParticiple: 'kept', presentParticiple: 'keeping', thirdPerson: 'keeps' },
    'let': { base: 'let', past: 'let', pastParticiple: 'let', presentParticiple: 'letting', thirdPerson: 'lets' },
    'begin': { base: 'begin', past: 'began', pastParticiple: 'begun', presentParticiple: 'beginning', thirdPerson: 'begins' },
    'bring': { base: 'bring', past: 'brought', pastParticiple: 'brought', presentParticiple: 'bringing', thirdPerson: 'brings' },
    'sit': { base: 'sit', past: 'sat', pastParticiple: 'sat', presentParticiple: 'sitting', thirdPerson: 'sits' },
    'stand': { base: 'stand', past: 'stood', pastParticiple: 'stood', presentParticiple: 'standing', thirdPerson: 'stands' },
    'lose': { base: 'lose', past: 'lost', pastParticiple: 'lost', presentParticiple: 'losing', thirdPerson: 'loses' },
    'pay': { base: 'pay', past: 'paid', pastParticiple: 'paid', presentParticiple: 'paying', thirdPerson: 'pays' },
    'meet': { base: 'meet', past: 'met', pastParticiple: 'met', presentParticiple: 'meeting', thirdPerson: 'meets' },
    'send': { base: 'send', past: 'sent', pastParticiple: 'sent', presentParticiple: 'sending', thirdPerson: 'sends' },
    'build': { base: 'build', past: 'built', pastParticiple: 'built', presentParticiple: 'building', thirdPerson: 'builds' },
    'fall': { base: 'fall', past: 'fell', pastParticiple: 'fallen', presentParticiple: 'falling', thirdPerson: 'falls' },
    'cut': { base: 'cut', past: 'cut', pastParticiple: 'cut', presentParticiple: 'cutting', thirdPerson: 'cuts' },
    'sell': { base: 'sell', past: 'sold', pastParticiple: 'sold', presentParticiple: 'selling', thirdPerson: 'sells' },
    'speak': { base: 'speak', past: 'spoke', pastParticiple: 'spoken', presentParticiple: 'speaking', thirdPerson: 'speaks' },
    'read': { base: 'read', past: 'read', pastParticiple: 'read', presentParticiple: 'reading', thirdPerson: 'reads' },
    'spend': { base: 'spend', past: 'spent', pastParticiple: 'spent', presentParticiple: 'spending', thirdPerson: 'spends' },
    'grow': { base: 'grow', past: 'grew', pastParticiple: 'grown', presentParticiple: 'growing', thirdPerson: 'grows' },
    'win': { base: 'win', past: 'won', pastParticiple: 'won', presentParticiple: 'winning', thirdPerson: 'wins' },
    'buy': { base: 'buy', past: 'bought', pastParticiple: 'bought', presentParticiple: 'buying', thirdPerson: 'buys' },
    'lead': { base: 'lead', past: 'led', pastParticiple: 'led', presentParticiple: 'leading', thirdPerson: 'leads' },
    'understand': { base: 'understand', past: 'understood', pastParticiple: 'understood', presentParticiple: 'understanding', thirdPerson: 'understands' },
    'hold': { base: 'hold', past: 'held', pastParticiple: 'held', presentParticiple: 'holding', thirdPerson: 'holds' },
    'write': { base: 'write', past: 'wrote', pastParticiple: 'written', presentParticiple: 'writing', thirdPerson: 'writes' },
    'eat': { base: 'eat', past: 'ate', pastParticiple: 'eaten', presentParticiple: 'eating', thirdPerson: 'eats' },
    'sing': { base: 'sing', past: 'sang', pastParticiple: 'sung', presentParticiple: 'singing', thirdPerson: 'sings' },
    'ring': { base: 'ring', past: 'rang', pastParticiple: 'rung', presentParticiple: 'ringing', thirdPerson: 'rings' },
    'swim': { base: 'swim', past: 'swam', pastParticiple: 'swum', presentParticiple: 'swimming', thirdPerson: 'swims' },
    'fly': { base: 'fly', past: 'flew', pastParticiple: 'flown', presentParticiple: 'flying', thirdPerson: 'flies' },
    'draw': { base: 'draw', past: 'drew', pastParticiple: 'drawn', presentParticiple: 'drawing', thirdPerson: 'draws' },
    'throw': { base: 'throw', past: 'threw', pastParticiple: 'thrown', presentParticiple: 'throwing', thirdPerson: 'throws' },
    'choose': { base: 'choose', past: 'chose', pastParticiple: 'chosen', presentParticiple: 'choosing', thirdPerson: 'chooses' },
    'break': { base: 'break', past: 'broke', pastParticiple: 'broken', presentParticiple: 'breaking', thirdPerson: 'breaks' },
    'wear': { base: 'wear', past: 'wore', pastParticiple: 'worn', presentParticiple: 'wearing', thirdPerson: 'wears' },
    'steal': { base: 'steal', past: 'stole', pastParticiple: 'stolen', presentParticiple: 'stealing', thirdPerson: 'steals' },
    'fight': { base: 'fight', past: 'fought', pastParticiple: 'fought', presentParticiple: 'fighting', thirdPerson: 'fights' },
    'catch': { base: 'catch', past: 'caught', pastParticiple: 'caught', presentParticiple: 'catching', thirdPerson: 'catches' },
    'teach': { base: 'teach', past: 'taught', pastParticiple: 'taught', presentParticiple: 'teaching', thirdPerson: 'teaches' },
    'forget': { base: 'forget', past: 'forgot', pastParticiple: 'forgotten', presentParticiple: 'forgetting', thirdPerson: 'forgets' },
    'hide': { base: 'hide', past: 'hid', pastParticiple: 'hidden', presentParticiple: 'hiding', thirdPerson: 'hides' },
    'rise': { base: 'rise', past: 'rose', pastParticiple: 'risen', presentParticiple: 'rising', thirdPerson: 'rises' },
    'lie': { base: 'lie', past: 'lay', pastParticiple: 'lain', presentParticiple: 'lying', thirdPerson: 'lies' },
    'lay': { base: 'lay', past: 'laid', pastParticiple: 'laid', presentParticiple: 'laying', thirdPerson: 'lays' },
    'exist': { base: 'exist', past: 'existed', pastParticiple: 'existed', presentParticiple: 'existing', thirdPerson: 'exists' }
  },
  
  // Irregular nouns (including common plurals that look like base forms)
  nouns: {
    'child': { base: 'child', plural: 'children', possessive: "child's" },
    'children': { base: 'child', plural: 'children', possessive: "children's" },
    'mouse': { base: 'mouse', plural: 'mice', possessive: "mouse's" },
    'mice': { base: 'mouse', plural: 'mice', possessive: "mice's" },
    'person': { base: 'person', plural: 'people', possessive: "person's" },
    'people': { base: 'person', plural: 'people', possessive: "people's" },
    'foot': { base: 'foot', plural: 'feet', possessive: "foot's" },
    'feet': { base: 'foot', plural: 'feet', possessive: "feet's" },
    'tooth': { base: 'tooth', plural: 'teeth', possessive: "tooth's" },
    'teeth': { base: 'tooth', plural: 'teeth', possessive: "teeth's" },
    'man': { base: 'man', plural: 'men', possessive: "man's" },
    'men': { base: 'man', plural: 'men', possessive: "men's" },
    'woman': { base: 'woman', plural: 'women', possessive: "woman's" },
    'women': { base: 'woman', plural: 'women', possessive: "women's" },
    'preference': { base: 'preference', plural: 'preferences', possessive: "preference's" },
    'preferences': { base: 'preference', plural: 'preferences', possessive: "preferences'" },
    'reference': { base: 'reference', plural: 'references', possessive: "reference's" },
    'references': { base: 'reference', plural: 'references', possessive: "references'" },
    'conference': { base: 'conference', plural: 'conferences', possessive: "conference's" },
    'conferences': { base: 'conference', plural: 'conferences', possessive: "conferences'" },
    'difference': { base: 'difference', plural: 'differences', possessive: "difference's" },
    'differences': { base: 'difference', plural: 'differences', possessive: "differences'" },
    'instance': { base: 'instance', plural: 'instances', possessive: "instance's" },
    'instances': { base: 'instance', plural: 'instances', possessive: "instances'" },
    'process': { base: 'process', plural: 'processes', possessive: "process's" },
    'processes': { base: 'process', plural: 'processes', possessive: "processes'" },
    'analysis': { base: 'analysis', plural: 'analyses', possessive: "analysis's" },
    'analyses': { base: 'analysis', plural: 'analyses', possessive: "analyses'" },
    'basis': { base: 'basis', plural: 'bases', possessive: "basis's" },
    'bases': { base: 'basis', plural: 'bases', possessive: "bases'" },
    'crisis': { base: 'crisis', plural: 'crises', possessive: "crisis's" },
    'crises': { base: 'crisis', plural: 'crises', possessive: "crises'" },
    'thesis': { base: 'thesis', plural: 'theses', possessive: "thesis's" },
    'theses': { base: 'thesis', plural: 'theses', possessive: "theses'" },
    'deer': { base: 'deer', plural: 'deer', possessive: "deer's" },
    'sheep': { base: 'sheep', plural: 'sheep', possessive: "sheep's" },
    'fish': { base: 'fish', plural: 'fish', possessive: "fish's" }
  },
  
  // Irregular adjectives
  adjectives: {
    'good': { base: 'good', comparative: 'better', superlative: 'best' },
    'better': { base: 'good', comparative: 'better', superlative: 'best' },
    'best': { base: 'good', comparative: 'better', superlative: 'best' },
    'bad': { base: 'bad', comparative: 'worse', superlative: 'worst' },
    'worse': { base: 'bad', comparative: 'worse', superlative: 'worst' },
    'worst': { base: 'bad', comparative: 'worse', superlative: 'worst' },
    'far': { base: 'far', comparative: 'farther', superlative: 'farthest' },
    'farther': { base: 'far', comparative: 'farther', superlative: 'farthest' },
    'farthest': { base: 'far', comparative: 'farther', superlative: 'farthest' },
    'little': { base: 'little', comparative: 'less', superlative: 'least' },
    'less': { base: 'little', comparative: 'less', superlative: 'least' },
    'least': { base: 'little', comparative: 'less', superlative: 'least' },
    'many': { base: 'many', comparative: 'more', superlative: 'most' },
    'much': { base: 'much', comparative: 'more', superlative: 'most' },
    'more': { base: 'many', comparative: 'more', superlative: 'most' },
    'most': { base: 'many', comparative: 'more', superlative: 'most' }
  }
};

// Create reverse lookup maps for fast searching
const verbForms = new Map();
const nounForms = new Map();
const adjectiveForms = new Map();

// Build reverse lookup maps
Object.entries(irregularWords.verbs).forEach(([baseForm, forms]) => {
  Object.values(forms).forEach(form => {
    if (!verbForms.has(form)) {
      verbForms.set(form, {
        base: forms.base,
        type: 'verb',
        currentForm: getVerbFormType(form, forms),
        allForms: forms
      });
    }
  });
});

Object.entries(irregularWords.nouns).forEach(([baseForm, forms]) => {
  Object.values(forms).forEach(form => {
    if (!nounForms.has(form)) {
      nounForms.set(form, {
        base: forms.base,
        type: 'noun', 
        currentForm: getNounFormType(form, forms),
        allForms: forms
      });
    }
  });
});

Object.entries(irregularWords.adjectives).forEach(([baseForm, forms]) => {
  Object.values(forms).forEach(form => {
    if (!adjectiveForms.has(form)) {
      adjectiveForms.set(form, {
        base: forms.base,
        type: 'adjective',
        currentForm: getAdjectiveFormType(form, forms),
        allForms: forms
      });
    }
  });
});

function getVerbFormType(form, allForms) {
  if (form === allForms.base) return 'infinitive';
  if (form === allForms.past) return 'past tense';
  if (form === allForms.pastParticiple) return 'past participle';
  if (form === allForms.presentParticiple) return 'present participle';
  if (form === allForms.thirdPerson) return 'third person singular';
  return 'unknown';
}

function getNounFormType(form, allForms) {
  if (form === allForms.base) return 'singular';
  if (form === allForms.plural) return 'plural';
  if (form === allForms.possessive) return 'possessive';
  return 'unknown';
}

function getAdjectiveFormType(form, allForms) {
  if (form === allForms.base) return 'positive';
  if (form === allForms.comparative) return 'comparative';
  if (form === allForms.superlative) return 'superlative';
  return 'unknown';
}

// Check irregular word dictionaries
function checkIrregularWordDictionaries(word) {
  // Check verbs
  if (verbForms.has(word)) {
    const verbInfo = verbForms.get(word);
    return {
      base: verbInfo.base,
      form: verbInfo.currentForm,
      type: 'verb',
      forms: generateVerbForms(verbInfo.allForms)
    };
  }
  
  // Check nouns
  if (nounForms.has(word)) {
    const nounInfo = nounForms.get(word);
    return {
      base: nounInfo.base,
      form: nounInfo.currentForm,
      type: 'noun',
      forms: generateNounForms(nounInfo.allForms)
    };
  }
  
  // Check adjectives
  if (adjectiveForms.has(word)) {
    const adjInfo = adjectiveForms.get(word);
    return {
      base: adjInfo.base,
      form: adjInfo.currentForm,
      type: 'adjective',
      forms: generateAdjectiveForms(adjInfo.allForms)
    };
  }
  
  return null;
}

// Generate forms for irregular verbs
function generateVerbForms(verbForms) {
  const base = verbForms.base;
  
  // Validate that base exists and is not undefined
  if (!base || base === 'undefined' || typeof base !== 'string') {
    console.error('❌ Invalid base form in generateVerbForms:', verbForms);
    return [{ form: 'error', word: 'error', example: 'Invalid verb form data' }];
  }
  
  console.log(`🔧 Generating verb forms for base: "${base}"`);
  
  // Generate missing forms if not provided
  let thirdPerson = verbForms.thirdPerson;
  if (!thirdPerson || thirdPerson === 'undefined') {
    if (base.endsWith('s') || base.endsWith('sh') || base.endsWith('ch') || 
        base.endsWith('x') || base.endsWith('z')) {
      thirdPerson = base + 'es';
    } else if (base.endsWith('y') && base.length > 1 && !'aeiou'.includes(base[base.length-2])) {
      thirdPerson = base.slice(0, -1) + 'ies';
    } else {
      thirdPerson = base + 's';
    }
    console.log(`🔧 Generated third person: "${thirdPerson}"`);
  }
  
  let presentParticiple = verbForms.presentParticiple;
  if (!presentParticiple || presentParticiple === 'undefined') {
    if (base.endsWith('e') && !base.endsWith('ee') && !base.endsWith('ie')) {
      presentParticiple = base.slice(0, -1) + 'ing';
    } else if (base.length >= 3 && 'bcdgklmnprstw'.includes(base[base.length-1]) &&
               'aeiou'.includes(base[base.length-2]) && !'aeiou'.includes(base[base.length-3])) {
      presentParticiple = base + base[base.length-1] + 'ing';
    } else {
      presentParticiple = base + 'ing';
    }
    console.log(`🔧 Generated present participle: "${presentParticiple}"`);
  }
  
  let past = verbForms.past;
  if (!past || past === 'undefined') {
    if (base.endsWith('e')) {
      past = base + 'd';
    } else if (base.endsWith('y') && base.length > 1 && !'aeiou'.includes(base[base.length-2])) {
      past = base.slice(0, -1) + 'ied';
    } else if (base.length >= 3 && 'bcdgklmnprstw'.includes(base[base.length-1]) &&
               'aeiou'.includes(base[base.length-2]) && !'aeiou'.includes(base[base.length-3])) {
      past = base + base[base.length-1] + 'ed';
    } else {
      past = base + 'ed';
    }
    console.log(`🔧 Generated past tense: "${past}"`);
  }
  
  let pastParticiple = verbForms.pastParticiple;
  if (!pastParticiple || pastParticiple === 'undefined') {
    pastParticiple = past;
    console.log(`🔧 Generated past participle from past: "${pastParticiple}"`);
  }
  
  // Final validation to prevent undefined values
  const forms = [
    { form: 'infinitive', word: base || 'error', example: `to ${base || 'error'}` },
    { form: 'third person singular', word: thirdPerson || 'error', example: `He/she ${thirdPerson || 'error'}.` },
    { form: 'past tense', word: past || 'error', example: `They ${past || 'error'}.` },
    { form: 'present participle', word: presentParticiple || 'error', example: `They are ${presentParticiple || 'error'}.` },
    { form: 'past participle', word: pastParticiple || 'error', example: `They have ${pastParticiple || 'error'}.` }
  ];
  
  return forms;
}

// Generate forms for irregular nouns
// Generate noun forms (singular, plural, possessive) with API validation
async function generateNounForms(word) {
  // Handle both string and object inputs
  let base;
  if (typeof word === 'string') {
    base = word.toLowerCase().trim();
  } else if (word && typeof word === 'object' && word.base) {
    base = word.base.toLowerCase().trim();
  } else {
    console.error('Invalid word parameter for generateNounForms:', word);
    return { singular: 'unknown', plural: 'unknown', possessive: 'unknown' };
  }
  let plural, possessive;
  
  // Generate plural form
  if (base.endsWith('s') || base.endsWith('x') || base.endsWith('z') || 
      base.endsWith('ch') || base.endsWith('sh')) {
    plural = base + 'es';
  } else if (base.endsWith('y') && base.length > 1 && !'aeiou'.includes(base[base.length-2])) {
    plural = base.slice(0, -1) + 'ies';
  } else if (base.endsWith('f')) {
    plural = base.slice(0, -1) + 'ves';
  } else if (base.endsWith('fe')) {
    plural = base.slice(0, -2) + 'ves';
  } else {
    plural = base + 's';
  }
  
  // Validate generated plural with dictionary API (silently, don't block if fails)
  try {
    const isPluralValid = await isActualEnglishWord(plural);
    if (!isPluralValid) {
      plural = base + 's';
    }
  } catch (error) {
  }
  
  // Generate possessive form
  possessive = base.endsWith('s') ? base + "'" : base + "'s";
  
  return {
    singular: base,
    plural: plural,
    possessive: possessive
  };
}

// Generate adjective forms (comparative, superlative) with API validation
async function generateAdjectiveForms(word) {
  const base = word.toLowerCase().trim();
  let comparative, superlative;
  
  // Smart comparative/superlative generation based on adjective length and pattern
  // Long adjectives (3+ syllables) typically use "more/most"
  if (base.length > 8 || 
      base.endsWith('ful') || base.endsWith('less') || base.endsWith('ous') ||
      base.endsWith('ent') || base.endsWith('ant') || base.endsWith('ive') ||
      base.endsWith('al') || base.endsWith('ic') || base.endsWith('able') || 
      base.endsWith('ible') || base.endsWith('ary') || base.endsWith('ory')) {
    comparative = `more ${base}`;
    superlative = `most ${base}`;
  }
  // Short adjectives (1-2 syllables) typically use "-er/-est"
  else if (base.length <= 6) {
    if (base.endsWith('y') && base.length > 1 && !'aeiou'.includes(base[base.length-2])) {
      // happy → happier, happiest
      comparative = base.slice(0, -1) + 'ier';
      superlative = base.slice(0, -1) + 'iest';
    } else if (base.length >= 3 && 'bcdgklmnprstw'.includes(base[base.length-1]) &&
               'aeiou'.includes(base[base.length-2]) && !'aeiou'.includes(base[base.length-3])) {
      // big → bigger, biggest
      comparative = base + base[base.length-1] + 'er';
      superlative = base + base[base.length-1] + 'est';
    } else {
      // simple → simpler, simplest
      comparative = base + 'er';
      superlative = base + 'est';
    }
  }
  // Medium adjectives - default to "more/most" for safety
  else {
    comparative = `more ${base}`;
    superlative = `most ${base}`;
  }
  
  // Validate generated forms with dictionary API (silently, don't block if fails)
  try {
    const isComparativeValid = await isActualEnglishWord(comparative);
    const isSuperlativeValid = await isActualEnglishWord(superlative);
    
    if (!isComparativeValid) {
      comparative = `more ${base}`;
    }
    if (!isSuperlativeValid) {
      superlative = `most ${base}`;
    }
  } catch (error) {
  }
  
  return {
    base: base,
    comparative: comparative,
    superlative: superlative
  };
}

// Primary synchronous function for word form info (uses dictionaries + algorithmic)
function getWordFormInfo(word) {
  const cleanWord = word.toLowerCase().trim();
  
  // Check comprehensive irregular word dictionaries first
  const irregularResult = checkIrregularWordDictionaries(cleanWord);
  if (irregularResult) {
    return irregularResult;
  }
  
  // Use algorithmic detection as fallback
  return getWordFormInfoAlgorithmic(cleanWord);
}

// Comprehensive rule-based morphological analysis
function getWordFormInfoAlgorithmic(word) {
  console.log(`🔧 Performing comprehensive rule-based analysis for "${word}"`);
  
  const cleanWord = word.toLowerCase().trim();
  
  // Comprehensive morphological analysis - check all patterns systematically
  
  // 1. ADVERBS (highest priority - most specific pattern)
  if (cleanWord.endsWith('ly') && cleanWord.length > 3) {
    return analyzeAdverb(cleanWord);
  }
  
  // 2. VERBS - Present Participle (-ing)
  if (cleanWord.endsWith('ing') && cleanWord.length > 4) {
    return analyzePresentParticiple(cleanWord);
  }
  
  // 3. VERBS - Past Tense/Past Participle (-ed)
  if (cleanWord.endsWith('ed') && cleanWord.length > 3) {
    return analyzePastForm(cleanWord);
  }
  
  // 4. NOUNS - Plurals (complex patterns first)
  if (cleanWord.endsWith('ies') && cleanWord.length > 4) {
    return analyzePluralIes(cleanWord);
  }
  if (cleanWord.endsWith('ves') && cleanWord.length > 4) {
    return analyzePluralVes(cleanWord);
  }
  if (cleanWord.endsWith('es') && cleanWord.length > 3) {
    return analyzePluralEs(cleanWord);
  }
  if (cleanWord.endsWith('s') && cleanWord.length > 2) {
    return analyzePluralS(cleanWord);
  }
  
  // 5. ADJECTIVES - Comparative and Superlative
  if (cleanWord.endsWith('est') && cleanWord.length > 4) {
    return analyzeSuperlative(cleanWord);
  }
  if (cleanWord.endsWith('er') && cleanWord.length > 3) {
    return analyzeComparative(cleanWord);
  }
  
  // 6. BASE FORMS with suffix-based type detection
  return analyzeBaseForm(cleanWord);
}

// Comprehensive adverb analysis
function analyzeAdverb(word) {
  
  let base = word.slice(0, -2); // Remove 'ly'
  
  // Handle complex adverb formation patterns
  if (base.endsWith('ical')) {
    // automatically → automatic, systematically → systematic
    base = base.slice(0, -2);
  } else if (base.endsWith('al')) {
    // logically → logical, basically → basic
    // Keep 'al' for most cases, but check for common exceptions
    if (['basic', 'magic', 'tragic', 'logic'].includes(base.slice(0, -2))) {
      base = base.slice(0, -2);
    }
  } else if (base.endsWith('le')) {
    // simply → simple, gently → gentle
    // 'le' is usually part of the base
  } else if (base.endsWith('y')) {
    // happily → happy, easily → easy
    // 'y' is usually part of the base
  } else if (base.endsWith('i')) {
    // heavily → heavy, angrily → angry
    base = base.slice(0, -1) + 'y';
  }
  
  const result = {
    base: base,
    form: 'adverb',
    type: 'adverb',
    forms: [
      { form: 'adjective (base)', word: base, example: `a ${base} thing` },
      { form: 'adverb', word: word, example: `done ${word}` }
    ]
  };
  
  return result;
}

// Present participle analysis with comprehensive silent 'e' restoration
function analyzePresentParticiple(word) {
  
  let base = word.slice(0, -3); // Remove 'ing'
  
  // Handle doubled consonants: running → run, sitting → sit
  if (base.length >= 2 && 
      base[base.length-1] === base[base.length-2] && 
      'bcdgklmnprstw'.includes(base[base.length-1])) {
    base = base.slice(0, -1);
  }
  // Handle silent e restoration with comprehensive approach
  else if (!base.endsWith('e') && base.length >= 3) {
    
    // Method 1: Check comprehensive list of common patterns
    const commonEVerbs = ['mak', 'com', 'tak', 'giv', 'hav', 'us', 'lov', 'hat', 'hop', 'car', 'sav', 'clos', 'writ', 'mov', 'configur', 'requir', 'receiv', 'believ', 'achiev', 'liv', 'leav', 'chang', 'manag', 'argu', 'danc', 'forc', 'serv', 'notic', 'practic', 'arriv', 'surviv', 'creat', 'updat', 'delet', 'complet', 'execut', 'generat', 'operat', 'calculat', 'demonstrat', 'separat', 'communic', 'coordinat', 'organiz', 'recogniz', 'realiz', 'memoriz', 'advertis', 'exercis', 'practis', 'promis', 'suppos', 'chos', 'los', 'clos', 'us', 'abus', 'excus', 'refus', 'caus', 'paus', 'pleas', 'teas', 'releas', 'increas', 'decreas'];
    
    if (commonEVerbs.includes(base)) {
      base = base + 'e';
    }
    // Method 2: Pattern-based detection for systematic coverage
    else {
      
      // Pattern: Most verbs ending in consonant + 'ur' need 'e' (configur → configure)
      if (base.endsWith('ur') && base.length > 3) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in consonant + 'at' need 'e' (creat → create)
      else if (base.endsWith('at') && base.length > 3 && !'aeiou'.includes(base[base.length-3])) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in consonant + 'iv' need 'e' (receiv → receive)
      else if (base.endsWith('iv') && base.length > 3) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in consonant + 'ov' need 'e' (mov → move)
      else if (base.endsWith('ov') && base.length > 3) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in consonant + 'id' need 'e' (decid → decide)
      else if (base.endsWith('id') && base.length > 3) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in consonant + 'ag' need 'e' (manag → manage)
      else if (base.endsWith('ag') && base.length > 3) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in consonant + 'ic' need 'e' (practic → practice)
      else if (base.endsWith('ic') && base.length > 3) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in 's' (not 'ss') need 'e' (chos → chose, us → use)
      else if (base.endsWith('s') && !base.endsWith('ss') && base.length > 2) {
        base = base + 'e';
      }
    }
  }
  
  const result = {
    base: base,
    form: 'present participle',
    type: 'verb',
    forms: generateVerbForms({ base: base, presentParticiple: word })
  };
  
  return result;
}

// Past tense/participle analysis
function analyzePastForm(word) {
  
  let base = word.slice(0, -2); // Remove 'ed'
  
  // Handle doubled consonants: stopped → stop
  if (base.length >= 2 && 
      base[base.length-1] === base[base.length-2] && 
      'bcdgklmnprstw'.includes(base[base.length-1])) {
    base = base.slice(0, -1);
  }
  // Handle y → i: tried → try
  else if (base.endsWith('i')) {
    base = base.slice(0, -1) + 'y';
  }
  // Handle silent e restoration with comprehensive approach: required → require, used → use
  else if (base.length >= 3 && !base.endsWith('e')) {
    
    // Method 1: Check comprehensive list of common patterns
    const commonEVerbs = ['requir', 'us', 'lov', 'hat', 'hop', 'car', 'sav', 'clos', 'writ', 'mov', 'receiv', 'believ', 'achiev', 'liv', 'leav', 'chang', 'manag', 'argu', 'danc', 'forc', 'serv', 'notic', 'practic', 'arriv', 'surviv', 'configur', 'creat', 'updat', 'delet', 'complet', 'execut', 'generat', 'operat', 'calculat', 'demonstrat', 'separat', 'communic', 'coordinat', 'organiz', 'recogniz', 'realiz', 'memoriz', 'advertis', 'exercis', 'practis', 'promis', 'suppos', 'chos', 'los', 'clos', 'abus', 'excus', 'refus', 'caus', 'paus', 'pleas', 'teas', 'releas', 'increas', 'decreas'];
    
    if (commonEVerbs.includes(base)) {
      base = base + 'e';
    }
    // Method 2: Pattern-based detection for systematic coverage
    else {
      
      // Pattern: Most verbs ending in consonant + 'ur' need 'e' (configur → configure)
      if (base.endsWith('ur') && base.length > 3) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in consonant + 'at' need 'e' (creat → create)
      else if (base.endsWith('at') && base.length > 3 && !'aeiou'.includes(base[base.length-3])) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in consonant + 'iv' need 'e' (receiv → receive)
      else if (base.endsWith('iv') && base.length > 3) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in consonant + 'ov' need 'e' (mov → move)
      else if (base.endsWith('ov') && base.length > 3) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in consonant + 'id' need 'e' (decid → decide)
      else if (base.endsWith('id') && base.length > 3) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in consonant + 'ag' need 'e' (manag → manage)
      else if (base.endsWith('ag') && base.length > 3) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in consonant + 'ic' need 'e' (practic → practice)
      else if (base.endsWith('ic') && base.length > 3) {
        base = base + 'e';
      }
      // Pattern: Most verbs ending in 's' (not 'ss') need 'e' (chos → chose, us → use)
      else if (base.endsWith('s') && !base.endsWith('ss') && base.length > 2) {
        base = base + 'e';
      }
    }
  }
  
  const result = {
    base: base,
    form: 'past tense',
    type: 'verb',
    forms: generateVerbForms({ base: base, past: word, pastParticiple: word })
  };
  
  return result;
}

// Plural -ies analysis
function analyzePluralIes(word) {
  const base = word.slice(0, -3) + 'y'; // flies → fly, babies → baby
  
  return {
    base: base,
    form: 'plural',
    type: 'noun',
    forms: generateNounForms({ base: base, plural: word })
  };
}

// Plural -ves analysis  
function analyzePluralVes(word) {
  let base;
  if (word.endsWith('ves')) {
    if (word.endsWith('ives')) {
      base = word.slice(0, -4) + 'ife'; // knives → knife
    } else {
      base = word.slice(0, -3) + 'f'; // wolves → wolf
    }
  }
  
  return {
    base: base,
    form: 'plural',
    type: 'noun',
    forms: generateNounForms({ base: base, plural: word })
  };
}

// Plural -es analysis
function analyzePluralEs(word) {
  const stem = word.slice(0, -2);
  let base;
  
  // Special case: -ences plurals
  if (word.endsWith('ences')) {
    base = word.slice(0, -1); // preferences → preference
  }
  // -ches, -shes, -xes, -zes patterns
  else if (stem.endsWith('ch') || stem.endsWith('sh') || stem.endsWith('x') || stem.endsWith('z')) {
    base = stem; // boxes → box, dishes → dish
  }
  // -ses patterns
  else if (stem.endsWith('s')) {
    base = stem; // glasses → glass
  }
  // Default -es removal
  else {
    base = stem;
  }
  
  return {
    base: base,
    form: 'plural',
    type: 'noun',
    forms: generateNounForms({ base: base, plural: word })
  };
}

// Regular plural -s analysis
function analyzePluralS(word) {
  const base = word.slice(0, -1);
  
  // Could be noun plural or verb third person singular
  // Default to noun for now, but include both possibilities
  return {
    base: base,
    form: 'plural',
    type: 'noun',
    forms: generateNounForms({ base: base, plural: word })
  };
}

// Superlative analysis
function analyzeSuperlative(word) {
  let base = word.slice(0, -3); // Remove 'est'
  
  // Handle doubled consonants: biggest → big
  if (base.length >= 2 && 
      base[base.length-1] === base[base.length-2] && 
      'bcdgklmnprstw'.includes(base[base.length-1])) {
    base = base.slice(0, -1);
  }
  // Handle y → i: happiest → happy
  else if (base.endsWith('i')) {
    base = base.slice(0, -1) + 'y';
  }
  
  return {
    base: base,
    form: 'superlative',
    type: 'adjective',
    forms: generateAdjectiveForms({ base: base, superlative: word })
  };
}

// Comparative analysis
function analyzeComparative(word) {
  let base = word.slice(0, -2); // Remove 'er'
  
  // Handle doubled consonants: bigger → big
  if (base.length >= 2 && 
      base[base.length-1] === base[base.length-2] && 
      'bcdgklmnprstw'.includes(base[base.length-1])) {
    base = base.slice(0, -1);
  }
  // Handle y → i: happier → happy
  else if (base.endsWith('i')) {
    base = base.slice(0, -1) + 'y';
  }
  
  return {
    base: base,
    form: 'comparative',
    type: 'adjective',
    forms: generateAdjectiveForms({ base: base, comparative: word })
  };
}

// Base form analysis with comprehensive suffix-based type detection
function analyzeBaseForm(word) {
  let type = 'unknown';
  
  
  // ADJECTIVE PATTERNS (comprehensive coverage)
  if (
    // Common adjective endings
    word.endsWith('able') || word.endsWith('ible') || // readable, incredible
    word.endsWith('ful') || word.endsWith('less') || // helpful, helpless
    word.endsWith('ous') || word.endsWith('ious') || // famous, serious
    word.endsWith('ent') || word.endsWith('ant') || // sufficient, important
    word.endsWith('ive') || word.endsWith('ative') || // active, creative
    word.endsWith('al') || word.endsWith('ial') || // personal, commercial
    word.endsWith('ic') || word.endsWith('tic') || // basic, automatic
    word.endsWith('ed') || word.endsWith('ing') || // interested, amazing (when used as adjectives)
    word.endsWith('ary') || word.endsWith('ory') || // necessary, mandatory
    word.endsWith('ean') || word.endsWith('ian') || // European, Christian
    word.endsWith('ese') || word.endsWith('ish') || // Chinese, British
    word.endsWith('ly') || // early, likely (when adjectives, not adverbs)
    word.endsWith('y') && word.length > 3 // happy, easy, busy
  ) {
    type = 'adjective';
  }
  
  // NOUN PATTERNS  
  else if (
    word.endsWith('tion') || word.endsWith('ation') || word.endsWith('sion') || // information, creation
    word.endsWith('ness') || word.endsWith('ment') || word.endsWith('ship') || // happiness, development
    word.endsWith('ity') || word.endsWith('ty') || // quality, safety
    word.endsWith('ance') || word.endsWith('ence') || // importance, difference
    word.endsWith('ism') || word.endsWith('ist') || // capitalism, scientist
    word.endsWith('er') || word.endsWith('or') || // teacher, actor
    word.endsWith('ure') || word.endsWith('ture') || // picture, culture
    word.endsWith('dom') || word.endsWith('hood') // freedom, childhood
  ) {
    type = 'noun';
  }
  
  // VERB PATTERNS
  else if (
    word.endsWith('ize') || word.endsWith('ise') || // realize, comprise
    word.endsWith('ify') || word.endsWith('fy') || // clarify, modify
    word.endsWith('ate') && word.length > 4 // create, calculate (avoid "ate" as noun)
  ) {
    type = 'verb';
  }
  
  // ADVERB PATTERNS (for completeness)
  else if (
    word.endsWith('ly') && word.length > 4 && // quickly, carefully
    !['early', 'only', 'likely', 'lovely', 'friendly', 'lonely'].includes(word) // exclude adjectives that end in -ly
  ) {
    type = 'adverb';
  }
  
  
  // Handle unknown words and common dual-purpose words
  if (type === 'unknown') {
    // List of common words that can be both nouns and verbs
    const commonNounVerbWords = [
      'garden', 'water', 'book', 'work', 'play', 'study', 'walk', 'run', 'jump',
      'dance', 'sleep', 'dream', 'cook', 'paint', 'drive', 'ride', 'swim', 'fly',
      'fish', 'hunt', 'shop', 'trade', 'change', 'help', 'care', 'love', 'hope',
      'fear', 'worry', 'plan', 'design', 'build', 'repair', 'clean', 'wash',
      'dry', 'iron', 'fold', 'pack', 'ship', 'mail', 'call', 'text', 'email',
      'visit', 'travel', 'camp', 'hike', 'climb', 'ski', 'surf', 'sail'
    ];
    
    if (commonNounVerbWords.includes(word)) {
      // For dual-purpose words, show both noun and verb forms with noun as primary
      type = 'noun and verb';
    } else {
      // Default to noun for other unknown words
      type = 'noun';
    }
  }
  
  return {
    base: word,
    form: 'base form',
    type: type,
    forms: generateBasicForms(word, type)
  };
}

// Generate basic forms for algorithmic fallback
function generateBasicForms(base, type) {
  const forms = [];
  
  if (type === 'verb' || type.includes('verb')) {
    forms.push({ form: 'infinitive', word: base, example: `to ${base}` });
    forms.push({ form: 'third person singular', word: base + 's', example: `He/she ${base}s.` });
    forms.push({ form: 'past tense', word: base + 'ed', example: `They ${base}ed.` });
    forms.push({ form: 'present participle', word: base + 'ing', example: `They are ${base}ing.` });
  }
  
  if (type === 'noun' || type.includes('noun')) {
    forms.push({ form: 'singular', word: base, example: `a ${base}` });
    let plural = base + 's';
    if (base.endsWith('s') || base.endsWith('sh') || base.endsWith('ch') || 
        base.endsWith('x') || base.endsWith('z')) {
      plural = base + 'es';
    }
    forms.push({ form: 'plural', word: plural, example: `many ${plural}` });
  }
  
  if (type === 'adjective') {
    forms.push({ form: 'positive', word: base, example: `a ${base} thing` });
    
    // Smart comparative/superlative generation based on adjective length and pattern
    let comparative, superlative;
    
    // Long adjectives (3+ syllables) typically use "more/most"
    if (base.length > 8 || 
        base.endsWith('ful') || base.endsWith('less') || base.endsWith('ous') ||
        base.endsWith('ent') || base.endsWith('ant') || base.endsWith('ive') ||
        base.endsWith('al') || base.endsWith('ic') || base.endsWith('able') || 
        base.endsWith('ible') || base.endsWith('ary') || base.endsWith('ory')) {
      comparative = `more ${base}`;
      superlative = `most ${base}`;
    }
    // Short adjectives (1-2 syllables) typically use "-er/-est"
    else if (base.length <= 6) {
      if (base.endsWith('y') && base.length > 1 && !'aeiou'.includes(base[base.length-2])) {
        // happy → happier, happiest
        comparative = base.slice(0, -1) + 'ier';
        superlative = base.slice(0, -1) + 'iest';
      } else if (base.length >= 3 && 'bcdgklmnprstw'.includes(base[base.length-1]) &&
                 'aeiou'.includes(base[base.length-2]) && !'aeiou'.includes(base[base.length-3])) {
        // big → bigger, biggest
        comparative = base + base[base.length-1] + 'er';
        superlative = base + base[base.length-1] + 'est';
      } else {
        // simple → simpler, simplest
        comparative = base + 'er';
        superlative = base + 'est';
      }
    }
    // Medium adjectives - default to "more/most" for safety
    else {
      comparative = `more ${base}`;
      superlative = `most ${base}`;
    }
    
    forms.push({ form: 'comparative', word: comparative, example: `${comparative} than others` });
    forms.push({ form: 'superlative', word: superlative, example: `the ${superlative} of all` });
  }
  
  if (type === 'adverb') {
    forms.push({ form: 'adverb', word: base, example: `done ${base}` });
  }
  
  if (forms.length === 0) {
    forms.push({ form: 'base', word: base, example: `This is ${base}` });
  }
  
  return forms;
}

// ===== API-FIRST MORPHOLOGICAL ANALYSIS =====
// Prioritizes accuracy through APIs and dictionaries over algorithmic detection

async function getWordFormInfoWithAPI(word, settings = null) {
  const cleanWord = word.toLowerCase().trim();
  
  
  // Step 1: ALWAYS try rule-based analysis FIRST for systematic pattern detection
  console.log('🔧 Using comprehensive rule-based morphological analysis...');
  const algorithmicResult = getWordFormInfoAlgorithmic(cleanWord);
  if (algorithmicResult && algorithmicResult.type !== 'unknown') {
    return algorithmicResult;
  }
  
  // Step 2: Check comprehensive irregular word dictionaries
  console.log('📖 Checking irregular word dictionaries...');
  const irregularResult = checkIrregularWordDictionaries(cleanWord);
  if (irregularResult) {
    return irregularResult;
  }
  
  // Step 3: Try Wiktionary API for additional validation
  try {
    console.log('📖 Trying Wiktionary API for morphological analysis...');
    const wiktResult = await callWiktionaryForMorphology(cleanWord);
    if (wiktResult && wiktResult.type !== 'unknown') {
      return wiktResult;
    }
  } catch (error) {
  }
  
  // Step 4: Try Free Dictionary API only for basic words not caught by rules
  try {
    console.log('📚 Trying Dictionary API for morphological analysis...');
    const dictResult = await callDictionaryForMorphology(cleanWord);
    if (dictResult && dictResult.type !== 'unknown') {
      return dictResult;
    }
  } catch (error) {
  }
  
  // Step 5: Try LLM API as absolute last resort (if configured)
  if (settings && hasEnabledLLMAPI(settings)) {
    try {
      console.log('📡 Trying LLM API as final fallback...');
      const apiResult = await callLLMForMorphology(cleanWord, settings);
      if (apiResult && apiResult.base) {
        return apiResult;
      }
    } catch (error) {
    }
  }
  
  // Ultimate fallback - return the algorithmic result even if type is unknown
  console.warn('⚠️ Using rule-based analysis as final fallback');
  return algorithmicResult || {
    base: cleanWord,
    form: 'base form',
    type: 'unknown',
    forms: [{ form: 'base', word: cleanWord, example: `This is ${cleanWord}` }]
  };
}

// Check if LLM API is available
function hasEnabledLLMAPI(settings) {
  if (!settings || !settings.providers) return false;
  return Object.values(settings.providers).some(provider => 
    provider.enabled && provider.apiKey && provider.apiKey.trim().length > 0
  );
}

// Call LLM API for morphological analysis
async function callLLMForMorphology(word, settings) {
  const morphPrompt = `Analyze the word "${word}" morphologically and provide ONLY this exact format:

BASE_FORM: [the dictionary/lemma form]
WORD_TYPE: [noun|verb|adjective|adverb|etc.]
CURRENT_FORM: [singular|plural|past_tense|present_participle|comparative|etc.]
OTHER_FORMS:
- [form1]: [example]
- [form2]: [example]
- [form3]: [example]

Be accurate and concise. Focus on the grammatical form, not the meaning.`;

  try {
    const response = await browser.runtime.sendMessage({
      command: "callLLMAPI",
      text: word,
      context: null,
      settings: { ...settings, prompt: morphPrompt }
    });
    
    const apiText = (typeof response === 'object' && response.text) ? response.text : response;
    return parseAPIWordFormResponse(apiText, word);
  } catch (error) {
    throw new Error(`LLM API call failed: ${error.message}`);
  }
}

// Call Wiktionary API for morphological analysis
async function callWiktionaryForMorphology(word) {
  try {
    console.log(`📖 Calling Wiktionary API for morphology of: "${word}"`);
    const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&format=json&origin=*&prop=text`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Wiktionary API error: ${response.status}`);
    }
    
    const data = await response.json();
    const html = data.parse && data.parse.text['*'];
    
    if (!html) {
      throw new Error('No Wiktionary page found for word');
    }
    
    console.log('📖 Wiktionary API response received');
    return parseWiktionaryWordFormResponse(html, word);
  } catch (error) {
    throw new Error(`Wiktionary API call failed: ${error.message}`);
  }
}

// Call Dictionary API for morphological analysis
async function callDictionaryForMorphology(word) {
  try {
    console.log(`📡 Calling Dictionary API for morphology of: "${word}"`);
    const response = await browser.runtime.sendMessage({
      command: 'callFreeDictionaryAPI',
      text: word
    });
    
    console.log('📖 Dictionary API response:', response);
    return parseDictionaryWordFormResponse(response, word);
  } catch (error) {
    throw new Error(`Dictionary API call failed: ${error.message}`);
  }
}

// Parse LLM API response for word form information
function parseAPIWordFormResponse(responseText, originalWord) {
  try {
    const lines = responseText.split('\n').map(line => line.trim()).filter(line => line);
    let base = originalWord.toLowerCase();
    let type = 'unknown';
    let form = 'base form';
    const forms = [];
    
    for (const line of lines) {
      if (line.startsWith('BASE_FORM:')) {
        base = line.replace('BASE_FORM:', '').trim().toLowerCase();
      } else if (line.startsWith('WORD_TYPE:')) {
        type = line.replace('WORD_TYPE:', '').trim().toLowerCase();
      } else if (line.startsWith('CURRENT_FORM:')) {
        form = line.replace('CURRENT_FORM:', '').trim();
      } else if (line.startsWith('OTHER_FORMS:')) {
        // Skip the header line
        continue;
      } else if (line.startsWith('-') && line.includes(':')) {
        // Parse form entries like "- plural: examples"
        const formMatch = line.match(/^-\s*([^:]+):\s*(.+)$/);
        if (formMatch) {
          const [, formName, example] = formMatch;
          const wordMatch = example.match(/\b([a-zA-Z]+(?:'[a-zA-Z]+)?)\b/);
          const wordForm = wordMatch ? wordMatch[1] : example.trim();
          forms.push({
            form: formName.trim(),
            word: wordForm.toLowerCase(),
            example: example.trim()
          });
        }
      }
    }
    
    // Validate that we got meaningful results
    if (base && base !== originalWord.toLowerCase() && base.length >= 2) {
      return { base, form, type, forms };
    }
    
    return null;
  } catch (error) {
    console.log('Error parsing API word form response:', error);
    return null;
  }
}

// Parse dictionary API response for word form information  
// Parse Wiktionary API response for morphological analysis
function parseWiktionaryWordFormResponse(html, originalWord) {
  try {
    
    if (!html || typeof html !== 'string') {
      return null;
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Find the English section
    const enHeader = Array.from(doc.querySelectorAll('h2')).find(h2 => 
      h2.textContent.includes('English')
    );
    
    if (!enHeader) {
      return null;
    }
    
    let base = originalWord.toLowerCase();
    let type = 'unknown';
    let form = 'base form';
    let currentForm = 'base form';
    
    // Look for part of speech headers after English section
    let el = enHeader.nextElementSibling;
    while (el && el.tagName !== 'H2') {
      if (el.tagName === 'H3' || el.tagName === 'H4') {
        const headerText = el.textContent.toLowerCase();
        if (headerText.includes('noun')) {
          type = 'noun';
        } else if (headerText.includes('verb')) {
          type = 'verb';
        } else if (headerText.includes('adjective')) {
          type = 'adjective';
        } else if (headerText.includes('adverb')) {
          type = 'adverb';
        }
        
        // Look for inflection information
        let nextEl = el.nextElementSibling;
        while (nextEl && !['H2', 'H3', 'H4'].includes(nextEl.tagName)) {
          const text = nextEl.textContent.toLowerCase();
          
          // Check for plural forms
          if (text.includes('plural of') || text.includes('plural form of')) {
            currentForm = 'plural';
            // Try to extract base form
            const baseMatch = text.match(/plural (?:form )?of\s+([a-zA-Z]+)/);
            if (baseMatch) {
              base = baseMatch[1].toLowerCase();
            }
          }
          
          // Check for verb forms
          if (text.includes('present participle') || text.includes('-ing form')) {
            currentForm = 'present participle';
            type = 'verb';
          }
          if (text.includes('past tense') || text.includes('past participle')) {
            currentForm = text.includes('past participle') ? 'past participle' : 'past tense';
            type = 'verb';
          }
          if (text.includes('third-person singular')) {
            currentForm = 'third person singular';
            type = 'verb';
          }
          
          // Check for adjective forms
          if (text.includes('comparative') || text.includes('more')) {
            currentForm = 'comparative';
            type = 'adjective';
          }
          if (text.includes('superlative') || text.includes('most')) {
            currentForm = 'superlative';
            type = 'adjective';
          }
          
          nextEl = nextEl.nextElementSibling;
        }
      }
      el = el.nextElementSibling;
    }
    
    console.log(`📖 Wiktionary detected - Type: ${type}, Form: ${currentForm}, Base: ${base}`);
    
    if (type !== 'unknown') {
      const ruleBasedInfo = getWordFormInfo(base);
      const result = {
        base: base,
        form: currentForm,
        type: type,
        forms: ruleBasedInfo.forms
      };
      return result;
    }
    
    return null;
  } catch (error) {
    console.log('Error parsing Wiktionary word form response:', error);
    return null;
  }
}

async function parseDictionaryWordFormResponse(responseText, originalWord) {
  try {
    
    if (!responseText || typeof responseText !== 'string') {
      return null;
    }
    
    // Extract key information from dictionary response
    const base = originalWord.toLowerCase(); // Dictionary usually gives the base form
    let type = 'unknown';
    let form = 'base form';
    
    // Always check for multi-type words in the full response first
    const lines = responseText.split('\n');
    const foundTypes = [];
    
    // Collect all word types found in structured sections - be more specific
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      // Look for structured headers or numbered definitions with word types
      if (line.includes('**adjective:**') || line.match(/^\d+\.\s.*\(adjective\)/) || line.match(/^adjective:/)) {
        foundTypes.push('adjective');
      } else if (line.includes('**noun:**') || line.match(/^\d+\.\s.*\(noun\)/) || line.match(/^noun:/)) {
        foundTypes.push('noun');
      } else if (line.includes('**verb:**') || line.match(/^\d+\.\s.*\(verb\)/) || line.match(/^verb:/)) {
        foundTypes.push('verb');
      } else if (line.includes('**adverb:**') || line.match(/^\d+\.\s.*\(adverb\)/) || line.match(/^adverb:/)) {
        foundTypes.push('adverb');
      }
    }
    
    // Set type based on found types, prioritizing multi-type combinations
    if (foundTypes.includes('noun') && foundTypes.includes('verb')) {
      type = 'noun and verb';
    } else if (foundTypes.includes('noun') && foundTypes.includes('adjective')) {
      type = 'noun and adjective';
    } else if (foundTypes.includes('verb') && foundTypes.includes('adjective')) {
      type = 'verb and adjective';
    } else {
      // Extract word type from the formatted response as fallback
      const wordTypeMatch = responseText.match(/\*\*Word Type:\*\*\s*\n([^\n]+)/);
      if (wordTypeMatch) {
        const fullTypeInfo = wordTypeMatch[1].trim();
        
        // Handle multi-type words (e.g., "verb (primary), also used as noun")
        if (fullTypeInfo.includes('also used as') || fullTypeInfo.includes(',')) {
          // If there's a clear primary designation, use that
          if (fullTypeInfo.includes('(primary)')) {
            const primaryTypeMatch = fullTypeInfo.match(/^([^(,]+)/);
            type = primaryTypeMatch ? primaryTypeMatch[1].trim().toLowerCase() : 'unknown';
          }
          // Otherwise, for ambiguous cases like "winter", prioritize noun
          else if (fullTypeInfo.toLowerCase().includes('noun')) {
            type = 'noun';
          } else {
            // Extract first type mentioned
            const primaryTypeMatch = fullTypeInfo.match(/^([^(,]+)/);
            type = primaryTypeMatch ? primaryTypeMatch[1].trim().toLowerCase() : fullTypeInfo.toLowerCase();
          }
        } else {
          // Single type word - but for common words like "winter", override verb to noun
          const singleType = fullTypeInfo.toLowerCase();
          if (singleType === 'verb' && ['winter', 'summer', 'spring', 'fall', 'autumn'].includes(originalWord.toLowerCase())) {
            type = 'noun';
          } else {
            type = singleType;
          }
        }
      } else if (foundTypes.includes('adjective')) {
        type = 'adjective';
      } else if (foundTypes.includes('noun')) {
        type = 'noun';
      } else if (foundTypes.includes('verb')) {
        type = 'verb';
      } else if (foundTypes.includes('adverb')) {
        type = 'adverb';
      } else {
        // Final fallback: prioritize noun as most words are nouns
        type = 'noun';
      }
    }
    
    // Apply seasonal word override after all word type detection
    if (type === 'verb' && ['winter', 'summer', 'spring', 'fall', 'autumn'].includes(originalWord.toLowerCase())) {
      type = 'noun';
    }
    
    
    // For dictionary responses, we typically get the base form
    // Generate forms based on the CORRECT type from dictionary, not algorithmic analysis
    if (type !== 'unknown') {
      const forms = await generateFormsForType(base, type);
      const result = {
        base: base,
        form: 'base form',
        type: type,
        forms: forms
      };
      return result;
    }
    
    return null;
  } catch (error) {
    console.log('Error parsing dictionary word form response:', error);
    return null;
  }
}

// Generate word forms based on known word type (not algorithmic detection)
async function generateFormsForType(word, type) {
  const forms = [];
  
  switch (type) {
    case 'adjective':
      // Generate adjective forms (comparative, superlative)
      const adjForms = await generateAdjectiveForms(word);
      forms.push(
        { form: 'positive', word: adjForms.base, example: `a ${adjForms.base} thing` },
        { form: 'comparative', word: adjForms.comparative, example: `${adjForms.comparative} than others` },
        { form: 'superlative', word: adjForms.superlative, example: `the ${adjForms.superlative} of all` }
      );
      break;
      
    case 'noun':
      // Generate noun forms (singular, plural, possessive)
      const nounForms = await generateNounForms(word);
      forms.push(
        { form: 'singular', word: nounForms.singular, example: `a ${nounForms.singular}` },
        { form: 'plural', word: nounForms.plural, example: `multiple ${nounForms.plural}` },
        { form: 'possessive', word: nounForms.possessive, example: `the ${nounForms.possessive} value` }
      );
      break;
      
    case 'verb':
      // Generate verb forms (base, past, participles)
      const verbForms = generateVerbForms(word);
      forms.push(
        { form: 'infinitive', word: verbForms.base, example: `to ${verbForms.base}` },
        { form: 'past tense', word: verbForms.past, example: `they ${verbForms.past}` },
        { form: 'present participle', word: verbForms.presentParticiple, example: `they are ${verbForms.presentParticiple}` },
        { form: 'past participle', word: verbForms.pastParticiple, example: `they have ${verbForms.pastParticiple}` }
      );
      break;
      
    case 'adverb':
      // Adverbs typically don't have multiple forms
      forms.push(
        { form: 'base', word: word, example: `done ${word}` }
      );
      break;
      
    case 'noun and verb':
      // Generate both noun and verb forms
      const nounForms2 = await generateNounForms(word);
      const verbForms2 = generateVerbForms(word);
      forms.push(
        { form: 'singular', word: nounForms2.singular, example: `a ${nounForms2.singular}` },
        { form: 'plural', word: nounForms2.plural, example: `multiple ${nounForms2.plural}` },
        { form: 'infinitive', word: verbForms2.base, example: `to ${verbForms2.base}` },
        { form: 'past tense', word: verbForms2.past, example: `they ${verbForms2.past}` },
        { form: 'present participle', word: verbForms2.presentParticiple, example: `they are ${verbForms2.presentParticiple}` },
        { form: 'past participle', word: verbForms2.pastParticiple, example: `they have ${verbForms2.pastParticiple}` }
      );
      break;
      
    case 'noun and adjective':
      // Generate both noun and adjective forms
      const nounForms3 = await generateNounForms(word);
      const adjForms3 = await generateAdjectiveForms(word);
      forms.push(
        { form: 'singular', word: nounForms3.singular, example: `a ${nounForms3.singular}` },
        { form: 'plural', word: nounForms3.plural, example: `multiple ${nounForms3.plural}` },
        { form: 'positive', word: adjForms3.base, example: `a ${adjForms3.base} thing` },
        { form: 'comparative', word: adjForms3.comparative, example: `${adjForms3.comparative} than others` },
        { form: 'superlative', word: adjForms3.superlative, example: `the ${adjForms3.superlative} of all` }
      );
      break;
      
    case 'verb and adjective':
      // Generate both verb and adjective forms
      const verbForms4 = generateVerbForms(word);
      const adjForms4 = await generateAdjectiveForms(word);
      forms.push(
        { form: 'infinitive', word: verbForms4.base, example: `to ${verbForms4.base}` },
        { form: 'past tense', word: verbForms4.past, example: `they ${verbForms4.past}` },
        { form: 'present participle', word: verbForms4.presentParticiple, example: `they are ${verbForms4.presentParticiple}` },
        { form: 'past participle', word: verbForms4.pastParticiple, example: `they have ${verbForms4.pastParticiple}` },
        { form: 'positive', word: adjForms4.base, example: `a ${adjForms4.base} thing` },
        { form: 'comparative', word: adjForms4.comparative, example: `${adjForms4.comparative} than others` },
        { form: 'superlative', word: adjForms4.superlative, example: `the ${adjForms4.superlative} of all` }
      );
      break;
      
    default:
      // Unknown type - just show the base form
      forms.push(
        { form: 'base', word: word, example: `this is ${word}` }
      );
      break;
  }
  
  return forms;
}

// Prepend word type and form information to an explanation if missing
function addWordInfoToExplanation(word, explanation) {
  const formInfo = getWordFormInfo(word);
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
  // FORCE REMOVE ALL existing SmartDefine modals and overlays
  
  // Remove by ID patterns
  const modalSelectors = [
    '#smartdefine-modal',
    '#smartdefine-save-modal', 
    '#smartdefine-export-modal',
    '[id^="smartdefine-"]',
    '[class*="smartdefine"]'
  ];
  
  modalSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      el.remove();
    });
  });
  
  // Remove any existing event listeners
  if (window.smartdefineEscapeHandler) {
    document.removeEventListener('keydown', window.smartdefineEscapeHandler);
    window.smartdefineEscapeHandler = null;
  }
  
  // Small delay to ensure cleanup
  await new Promise(resolve => setTimeout(resolve, 100));

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
  // Only show "AI-Powered" when an actual LLM API was used, not for dictionary lookups
  if (provider && provider !== 'FreeDictionary' && provider !== 'text') {
    subtitle.textContent = 'AI-Powered Word Explanation';
  } else {
    subtitle.textContent = 'Word Explanation';
  }
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

  // Word type and form information with API validation
  let wordInfo;
  
  // Only show word forms in the final result, not during loading, and not for failed dictionary lookups
  if (response !== "Loading explanation..." && 
      response !== "Loading definition from dictionary..." &&
      !response.includes('Unable to get definition') &&
      !response.includes('This word was not found in the dictionary')) {
    
    try {
      // Try to get API-validated word form info
      const settings = await browser.storage.local.get(['selectedProvider', 'prompt', 'providers']);
      wordInfo = await getWordFormInfoWithAPI(selectedText, settings);
    } catch (error) {
      wordInfo = getWordFormInfo(selectedText);
    }
    
    // DEBUGGING: Force check what the word should be
    if (selectedText.toLowerCase() === 'automatically') {
      const debugResult = getWordFormInfoAlgorithmic('automatically');
      if (debugResult.type === 'adverb') {
        wordInfo = debugResult;
      }
    }
    
    // Create properly formatted word information section
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border: 1px solid #dee2e6;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    
    const infoTitle = document.createElement('h3');
    infoTitle.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
      border-bottom: 2px solid #4CAF50;
      padding-bottom: 8px;
    `;
    infoTitle.textContent = '📝 Word Analysis';
    
    const typeDiv = document.createElement('div');
    typeDiv.style.cssText = `
      display: flex;
      gap: 20px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    `;
    
    const wordTypeSpan = document.createElement('span');
    wordTypeSpan.innerHTML = `<strong>Word Type:</strong> <span style="color: #4CAF50; font-weight: 600;">${wordInfo.type}</span>`;
    
    const currentFormSpan = document.createElement('span');
    currentFormSpan.innerHTML = `<strong>Current Form:</strong> <span style="color: #2196F3; font-weight: 600;">${wordInfo.form}</span>`;
    
    typeDiv.appendChild(wordTypeSpan);
    typeDiv.appendChild(currentFormSpan);
    
    infoDiv.appendChild(infoTitle);
    infoDiv.appendChild(typeDiv);
    
    if (wordInfo.forms.length > 0) {
      const formsTitle = document.createElement('h4');
      formsTitle.style.cssText = `
        margin: 16px 0 12px 0;
        font-size: 16px;
        font-weight: 600;
        color: #333;
      `;
      formsTitle.textContent = 'Other Forms:';
      
      const formsList = document.createElement('div');
      formsList.style.cssText = `
        display: grid;
        gap: 8px;
        margin-left: 0;
      `;
      
      wordInfo.forms.forEach(f => {
        const formItem = document.createElement('div');
        formItem.style.cssText = `
          background: rgba(76, 175, 80, 0.1);
          border-left: 4px solid #4CAF50;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 14px;
        `;
        formItem.innerHTML = `<strong>${f.word}</strong> <span style="color: #666;">(${f.form})</span> - <em>${f.example}</em>`;
        formsList.appendChild(formItem);
      });
      
      infoDiv.appendChild(formsTitle);
      infoDiv.appendChild(formsList);
    }
    
    contentArea.appendChild(infoDiv);
  }

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

  // Add save button if enabled and not loading and not a failed lookup
  if (learningSettings.saveToWordList && learningSettings.showSaveButton && 
      response !== "Loading explanation..." && 
      !response.includes('Unable to get definition') &&
      !response.includes('This word was not found in the dictionary')) {
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
      showSaveToListModal(selectedText, response, context, provider, wordInfo);
    };
    
    header.appendChild(saveButton);
  }

  // Add export button if not loading and not a failed lookup
  if (response !== "Loading explanation..." && 
      !response.includes('Unable to get definition') &&
      !response.includes('This word was not found in the dictionary')) {
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
    document.removeEventListener('keydown', window.smartdefineEscapeHandler);
    window.smartdefineEscapeHandler = null;
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
  
  // Store reference to prevent multiple listeners
  window.smartdefineEscapeHandler = escapeHandler;
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
  
  const formInfo = getWordFormInfo(word);
  const baseWord = formInfo.base;

  const finalExplanation = addWordInfoToExplanation(word, explanation);

  // For learning purposes, save the ORIGINAL form (what user encountered)
  // but store the base form for reference and deduplication
  
  // Check if word already exists in this category with same provider
  // Use the original form for comparison to avoid duplicates like "run" and "running"
  const existingIndex = wordLists[category].findIndex(item =>
    item.word.toLowerCase() === word.toLowerCase() && item.provider === provider);
  
  const wordId = existingIndex >= 0
    ? wordLists[category][existingIndex].id
    : (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  const wordData = {
    id: wordId,
    word: word, // Save the ORIGINAL word the user encountered
    baseForm: baseWord, // Store base form for reference
    wordType: formInfo.type,
    currentForm: formInfo.form,
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
    const rawSelectedText = message.text;
    const selectedText = await extractFirstValidWord(rawSelectedText);
    
    
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
    
    try {
      if (hasAPIKey) {
        // Show loading message immediately only if we have an API key
        await createResponseModal(selectedText, "Loading explanation...");
        
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

        // Ensure previous modal is completely removed before creating new one
        await new Promise(resolve => setTimeout(resolve, 150));

        if (response && typeof response === 'object') {
          console.log('LLM Response from', response.provider + ':', response.text);
          await createResponseModal(selectedText, response.text, context, response.provider);
        } else {
          console.log('LLM Response:', response);
          await createResponseModal(selectedText, response, context, null);
        }
      } else {
        // No API key configured, directly use free dictionary API
        console.log('No API key found, using free dictionary service');
        
        // Show loading message for dictionary lookup
        await createResponseModal(selectedText, "Loading definition from dictionary...", null, 'FreeDictionary');
        
        try {
          const dictionaryResponse = await browser.runtime.sendMessage({
            command: 'callFreeDictionaryAPI',
            text: selectedText
          });

          console.log('Dictionary Response:', dictionaryResponse);

          // Ensure previous modal is completely removed before creating new one
          await new Promise(resolve => setTimeout(resolve, 150));

          // Update modal with dictionary response
          await createResponseModal(selectedText, dictionaryResponse, null, 'FreeDictionary');
        } catch (dictError) {
          console.error('Dictionary API failed:', dictError);
          const errorMessage = `Unable to get definition for "${selectedText}". This word was not found in the dictionary (it may be a proper noun, technical term, or very specialized word). For comprehensive explanations of all words, please configure an LLM API key in the extension settings.`;
          await createResponseModal(selectedText, errorMessage, null, 'FreeDictionary');
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
        await createResponseModal(selectedText, fallbackResponse, null, 'FreeDictionary');
      } catch (dictError) {
        console.error('Both LLM and dictionary APIs failed:', dictError);
        const errorMessage = `Unable to get explanation for "${selectedText}". Both AI service and dictionary lookup failed. Please check your internet connection or try again later.`;
        await createResponseModal(selectedText, errorMessage, null, 'FreeDictionary');
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
function exportToTXT(selectedText, response) {
  const prepared = addWordInfoToExplanation(selectedText, response);
  const content = `${selectedText}\n\n${cleanMarkdownText(prepared)}\n\nExported from SmartDefine Extension\nDate: ${new Date().toLocaleDateString()}`;
  downloadFile(content, `${selectedText}.txt`, 'text/plain');
  showMessage(`"${selectedText}" exported to TXT!`, 'success');
}

// Export to PDF function (downloads HTML file for printing to PDF)
function exportToPDFContent(selectedText, response) {
  try {
    const htmlContent = generateSingleWordPDFContent(selectedText, response);
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
function generateSingleWordPDFContent(selectedText, response) {
  try {
    const prepared = addWordInfoToExplanation(selectedText, response);
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
