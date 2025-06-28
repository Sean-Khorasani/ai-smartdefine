// src/background/background.js

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "explain-me",
    title: "SmartDefine: '%s'",
    contexts: ["selection"]
  });
  
  // Initialize learning engine background tasks
  initializeLearningEngine();
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "explain-me") {
    browser.tabs.sendMessage(tab.id, {
      command: "explainSelectedText",
      text: info.selectionText
    });
  }
});

// Initialize default settings
browser.runtime.onInstalled.addListener(() => {
  browser.storage.local.set({
    selectedProvider: "Together",
    prompt: "Explain the word 'X_WORD_X' using EXACTLY this format with these exact headers. Do not skip any section:\n\n**Meaning:**\n[Clear definition of the word]\n\n**Respelling:**\n[Simplified phonetics like (en-KOM-pass-ing), not IPA]\n\n**Synonyms:**\n- word1 (pronunciation)\n- word2 (pronunciation)\n- word3 (pronunciation)\n\n**Antonyms:**\n- word1 (pronunciation)\n- word2 (pronunciation)\n- word3 (pronunciation)\n\n**Examples:**\n- Example sentence 1\n- Example sentence 2\n- Example sentence 3\n\n**Collocations:**\n- common phrase 1\n- common phrase 2\n- common phrase 3\n\n**Ways to remember:**\n- Memory aid or mnemonic device",
    providers: {
      Together: {
        baseUrl: "https://api.together.xyz",
        model: "meta-llama/Llama-3-70b-chat-hf",
        apiKey: ""
      },
      OpenRouter: {
        baseUrl: "https://openrouter.ai/api/v1",
        model: "google/gemini-flash-1.5",
        apiKey: ""
      }
    },
    learningSettings: {
      saveToWordList: true,
      flashcardSystem: true,
      quizMode: true,
      spacedRepetition: true,
      showSaveButton: true,
      autoSave: false,
      dailyGoal: 10,
      reviewReminders: true,
      contextAwareDefinitions: true
    },
    wordLists: {}
  });
});


// Function to call different LLM APIs with fallback when one fails
async function callLLMAPI(selectedText, context, settings) {
  const { selectedProvider, prompt, providers } = settings;

  if (!providers || Object.keys(providers).length === 0) {
    throw new Error('Provider configuration not found');
  }

  // Build the prompt once
  let finalPrompt = prompt.replace(/X_WORD_X/g, selectedText);
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

  // Determine provider order (selected provider first, then others)
  const providerOrder = [];
  if (selectedProvider && providers[selectedProvider]) {
    providerOrder.push(selectedProvider);
  }
  for (const name of Object.keys(providers)) {
    if (name !== selectedProvider) providerOrder.push(name);
  }

  let lastError = null;
  for (const name of providerOrder) {
    const config = providers[name];
    if (!config || !config.apiKey || config.apiKey.trim() === '') {
      lastError = new Error(`API key not configured for ${name}`);
      continue;
    }

    try {
      switch (name) {
        case 'Together':
          return await callTogetherAPI(finalPrompt, config.baseUrl, config.model, config.apiKey);
        case 'OpenRouter':
          return await callOpenRouterAPI(finalPrompt, config.baseUrl, config.model, config.apiKey);
        default:
          lastError = new Error(`Unsupported provider: ${name}`);
      }
    } catch (err) {
      lastError = err;
      console.warn(`${name} provider failed:`, err.message);
    }
  }

  throw lastError || new Error('All providers failed');
}


// Together.ai API call
async function callTogetherAPI(prompt, baseUrl, model, apiKey) {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{
        role: 'user',
        content: prompt
      }],
      max_tokens: 1000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Together API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
  }

  const data = await response.json();
  
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content;
  } else {
    throw new Error('Invalid response from Together API');
  }
}

// OpenRouter API call
async function callOpenRouterAPI(prompt, baseUrl, model, apiKey) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://smartdefine-extension.com',
      'X-Title': 'SmartDefine Extension'
    },
    body: JSON.stringify({
      model: model,
      messages: [{
        role: 'user',
        content: prompt
      }],
      max_tokens: 1000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
  }

  const data = await response.json();
  
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content;
  } else {
    throw new Error('Invalid response from OpenRouter API');
  }
}

// === LEARNING ENGINE INTEGRATION ===

// Global learning engine instance
let learningEngine = null;

// Initialize learning engine and background tasks
async function initializeLearningEngine() {
  // Create basic learning engine (advanced features will be added as separate modules)
  learningEngine = new BasicLearningEngine();
  
  // Set up background tasks
  await setupBackgroundTasks();
  
  console.log('Learning engine initialized successfully');
}

// Setup background learning tasks
async function setupBackgroundTasks() {
  if (!learningEngine) return;
  
  // Schedule background review checks every hour
  browser.alarms.create('overdueCheck', {
    delayInMinutes: 60,
    periodInMinutes: 60
  });
  
  // Schedule daily review reminder at 7 PM
  const now = new Date();
  const reminderTime = new Date();
  reminderTime.setHours(19, 0, 0, 0);
  
  if (now > reminderTime) {
    reminderTime.setDate(reminderTime.getDate() + 1);
  }
  
  browser.alarms.create('dailyReviewReminder', {
    when: reminderTime.getTime(),
    periodInMinutes: 24 * 60
  });
  
  // Listen for alarm events
  browser.alarms.onAlarm.addListener(async (alarm) => {
    switch (alarm.name) {
      case 'dailyReviewReminder':
        await sendReviewReminder();
        break;
      case 'overdueCheck':
        await updateOverdueBadge();
        break;
    }
  });
  
  // Update badge on startup
  await updateOverdueBadge();
}

// Send review reminder notification
async function sendReviewReminder() {
  try {
    const storage = await browser.storage.local.get(['wordLists', 'learningSettings']);
    const settings = storage.learningSettings || {};
    
    if (!settings.reviewReminders) return;
    
    const dueWords = await learningEngine.getWordsForReview(storage.wordLists || {});
    
    if (dueWords.length > 0) {
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('icons/icon-48.png'),
        title: 'SmartDefine - Review Time!',
        message: `You have ${dueWords.length} words ready for review. Keep your learning streak going!`
      });
    }
  } catch (error) {
    console.error('Error sending review reminder:', error);
  }
}

// Update browser badge with overdue word count
async function updateOverdueBadge() {
  try {
    const storage = await browser.storage.local.get(['wordLists', 'learningSettings']);
    const settings = storage.learningSettings || {};
    
    if (!settings.reviewReminders) {
      browser.browserAction.setBadgeText({ text: '' });
      return;
    }
    
    if (learningEngine && storage.wordLists) {
      const dueWords = await learningEngine.getWordsForReview(storage.wordLists);
      const overdueCount = dueWords.length;
      
      if (overdueCount > 0) {
        browser.browserAction.setBadgeText({ text: overdueCount.toString() });
        browser.browserAction.setBadgeBackgroundColor({ color: '#FF5722' });
      } else {
        browser.browserAction.setBadgeText({ text: '' });
      }
    }
  } catch (error) {
    console.error('Error updating overdue badge:', error);
  }
}

// Enhanced message handler for learning features  
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    // API call handlers
    if (message.command === "callLLMAPI") {
      try {
        const response = await callLLMAPI(message.text, message.context, message.settings);
        return response;
      } catch (error) {
        // If LLM API fails, try free dictionary API as fallback
        console.warn('LLM API failed, trying dictionary fallback:', error.message);
        try {
          const dictionaryResponse = await callFreeDictionaryAPI(message.text);
          return dictionaryResponse;
        } catch (dictError) {
          throw new Error(`Both LLM and dictionary APIs failed. LLM: ${error.message}, Dictionary: ${dictError.message}`);
        }
      }
    }
    
    if (message.command === "callFreeDictionaryAPI") {
      const response = await callFreeDictionaryAPI(message.text);
      return response;
    }
    
    if (message.command === "openOptions") {
      await browser.tabs.create({
        url: browser.runtime.getURL('src/ui/extension_tabs.html?tab=settings')
      });
      return { success: true };
    }
    
    // Learning engine commands
    if (message.command === "processWordReview" && learningEngine) {
      const updatedWordData = await learningEngine.processReview(
        message.wordData, 
        message.reviewResult
      );
      return { success: true, wordData: updatedWordData };
    }
    
    if (message.command === "getWordsForReview" && learningEngine) {
      const storage = await browser.storage.local.get(['wordLists']);
      const dueWords = await learningEngine.getWordsForReview(
        storage.wordLists || {},
        message.reviewType || 'all',
        message.limit || 20
      );
      return { success: true, words: dueWords };
    }
    
    if (message.command === "getStudyStats" && learningEngine) {
      const storage = await browser.storage.local.get(['wordLists']);
      const stats = learningEngine.getStudyStats(storage.wordLists || {});
      return { success: true, stats };
    }
    
    if (message.command === "updateOverdueBadge") {
      await updateOverdueBadge();
      return { success: true };
    }
  } catch (error) {
    console.error(`Error handling command ${message.command}:`, error);
    throw error;
  }
});

// Basic Learning Engine with Spaced Repetition
class BasicLearningEngine {
  async processReview(wordData, reviewResult) {
    const { isCorrect, responseTime = 5000, confidenceLevel = 0.5 } = reviewResult;
    
    // Update review metrics
    const reviewCount = (wordData.reviewCount || 0) + 1;
    const currentEase = wordData.easeFactor || 2.5;
    const currentInterval = wordData.interval || 1;
    
    // Calculate new ease factor (SM-2 algorithm simplified)
    let newEaseFactor = currentEase;
    if (isCorrect) {
      newEaseFactor = Math.min(currentEase + 0.1, 3.0);
    } else {
      newEaseFactor = Math.max(currentEase - 0.2, 1.3);
    }
    
    // Adjust based on confidence
    if (confidenceLevel < 0.5) {
      newEaseFactor = Math.max(newEaseFactor - 0.1, 1.3);
    } else if (confidenceLevel > 0.8) {
      newEaseFactor = Math.min(newEaseFactor + 0.05, 3.0);
    }
    
    // Calculate new interval
    let newInterval;
    if (isCorrect) {
      if (currentInterval === 1) {
        newInterval = 6;
      } else {
        newInterval = Math.round(currentInterval * newEaseFactor);
      }
    } else {
      newInterval = 1; // Reset for incorrect answers
    }
    
    // Cap maximum interval
    newInterval = Math.min(newInterval, 365);
    
    // Determine difficulty level
    let difficulty = wordData.difficulty || 'new';
    if (reviewCount >= 2 && difficulty === 'new') {
      difficulty = 'learning';
    } else if (reviewCount >= 5 && newEaseFactor >= 2.5 && difficulty === 'learning') {
      difficulty = 'mastered';
    } else if (difficulty === 'mastered' && newEaseFactor < 2.0) {
      difficulty = 'learning';
    }
    
    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + newInterval);
    
    return {
      ...wordData,
      reviewCount,
      lastReviewed: new Date().toISOString(),
      difficulty,
      easeFactor: Math.round(newEaseFactor * 100) / 100,
      interval: newInterval,
      nextReview: nextReview.toISOString(),
      averageResponseTime: Math.round((wordData.averageResponseTime || responseTime) * 0.8 + responseTime * 0.2),
      confidenceScore: Math.round((wordData.confidenceScore || confidenceLevel) * 0.8 + confidenceLevel * 0.2)
    };
  }
  
  async getWordsForReview(wordLists, reviewType = 'all', limit = 20) {
    const now = new Date();
    const dueWords = [];
    
    Object.keys(wordLists).forEach(category => {
      wordLists[category].forEach(word => {
        // Handle words without review scheduling data (legacy words)
        let nextReviewDate;
        if (word.nextReview) {
          nextReviewDate = new Date(word.nextReview);
        } else {
          // Legacy word without review scheduling - make immediately available
          nextReviewDate = new Date(now.getTime() - 1000); // 1 second ago
        }
        
        const isDue = nextReviewDate <= now;
        
        if (isDue && this.shouldIncludeInReview(word, reviewType)) {
          const overdueDays = Math.max(0, (now - nextReviewDate) / (1000 * 60 * 60 * 24));
          dueWords.push({
            ...word,
            category,
            priority: this.calculatePriority(word, overdueDays)
          });
        }
      });
    });
    
    // Sort by priority (overdue words first)
    dueWords.sort((a, b) => b.priority - a.priority);
    
    return dueWords.slice(0, limit);
  }
  
  shouldIncludeInReview(word, reviewType) {
    switch (reviewType) {
      case 'new':
        return word.difficulty === 'new';
      case 'learning':
        return word.difficulty === 'learning';
      case 'review':
        return word.difficulty === 'mastered';
      case 'difficult':
        return (word.easeFactor || 2.5) < 2.0;
      case 'all':
      default:
        return true;
    }
  }
  
  calculatePriority(word, overdueDays) {
    let priority = 0;
    
    // Overdue penalty
    priority += overdueDays * 10;
    
    // Difficulty priority
    switch (word.difficulty) {
      case 'new':
        priority += 100;
        break;
      case 'learning':
        priority += 50;
        break;
      case 'mastered':
        priority += 10;
        break;
    }
    
    // Low ease factor priority
    if ((word.easeFactor || 2.5) < 2.0) {
      priority += 25;
    }
    
    return priority;
  }
  
  getStudyStats(wordLists) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let totalWords = 0;
    let newWords = 0;
    let learningWords = 0;
    let masteredWords = 0;
    let overdueWords = 0;
    let todayReviews = 0;
    
    Object.values(wordLists).forEach(category => {
      category.forEach(word => {
        totalWords++;
        
        switch (word.difficulty) {
          case 'new':
            newWords++;
            break;
          case 'learning':
            learningWords++;
            break;
          case 'mastered':
            masteredWords++;
            break;
        }
        
        const nextReviewDate = new Date(word.nextReview || now);
        if (nextReviewDate <= now) {
          overdueWords++;
        }
        
        if (word.lastReviewed) {
          const lastReviewDate = new Date(word.lastReviewed);
          if (lastReviewDate >= today) {
            todayReviews++;
          }
        }
      });
    });
    
    return {
      totalWords,
      newWords,
      learningWords,
      masteredWords,
      overdueWords,
      todayReviews
    };
  }
}

// Initialize learning engine when background script loads
initializeLearningEngine();

// === FREE DICTIONARY API FALLBACK ===

// Call Free Dictionary API as fallback when LLM APIs fail
async function callFreeDictionaryAPI(word) {
  try {
    console.log('Calling free dictionary API for word:', word);
    const cleanWord = word.toLowerCase().trim();
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`;
    console.log('Dictionary API URL:', url);
    
    const response = await fetch(url);
    console.log('Dictionary API response status:', response.status);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Word "${word}" not found in dictionary`);
      }
      throw new Error(`Dictionary API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Dictionary API data:', data);
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('No definition found');
    }
    
    const formattedResponse = formatDictionaryResponse(data[0], word);
    console.log('Formatted dictionary response:', formattedResponse);
    return formattedResponse;
  } catch (error) {
    console.error('Dictionary API error:', error);
    if (error.message.includes('fetch')) {
      throw new Error('Dictionary service unavailable (offline?)');
    }
    throw error;
  }
}

// Format dictionary API response to match LLM response format
function formatDictionaryResponse(entry, originalWord) {
  let formattedResponse = '';
  
  // Header
  formattedResponse += `**📖 Dictionary Definition for "${originalWord}"**\n\n`;
  formattedResponse += `*(Powered by Free Dictionary API)*\n\n`;
  
  // Meaning section
  formattedResponse += `**Meaning:**\n`;
  if (entry.meanings && entry.meanings.length > 0) {
    const primaryMeaning = entry.meanings[0];
    if (primaryMeaning.definitions && primaryMeaning.definitions.length > 0) {
      formattedResponse += `${primaryMeaning.definitions[0].definition}\n\n`;
    }
  }
  
  // Phonetic section
  formattedResponse += `**Phonetics:**\n`;
  if (entry.phonetic) {
    formattedResponse += `${entry.phonetic}\n\n`;
  } else if (entry.phonetics && entry.phonetics.length > 0) {
    const phoneticEntry = entry.phonetics.find(p => p.text) || entry.phonetics[0];
    if (phoneticEntry && phoneticEntry.text) {
      formattedResponse += `${phoneticEntry.text}\n\n`;
    }
  } else {
    formattedResponse += `(Phonetic not available)\n\n`;
  }
  
  // Multiple meanings by part of speech
  if (entry.meanings && entry.meanings.length > 0) {
    entry.meanings.forEach((meaning, index) => {
      if (meaning.partOfSpeech) {
        formattedResponse += `**${meaning.partOfSpeech.charAt(0).toUpperCase() + meaning.partOfSpeech.slice(1)}:**\n`;
        
        if (meaning.definitions && meaning.definitions.length > 0) {
          meaning.definitions.slice(0, 3).forEach((def, defIndex) => {
            formattedResponse += `${defIndex + 1}. ${def.definition}\n`;
            if (def.example) {
              formattedResponse += `   Example: "${def.example}"\n`;
            }
          });
          formattedResponse += `\n`;
        }
      }
    });
  }
  
  // Synonyms
  const synonyms = extractSynonymsFromEntry(entry);
  if (synonyms.length > 0) {
    formattedResponse += `**Synonyms:**\n`;
    synonyms.slice(0, 5).forEach(synonym => {
      formattedResponse += `- ${synonym}\n`;
    });
    formattedResponse += `\n`;
  }
  
  // Antonyms
  const antonyms = extractAntonymsFromEntry(entry);
  if (antonyms.length > 0) {
    formattedResponse += `**Antonyms:**\n`;
    antonyms.slice(0, 5).forEach(antonym => {
      formattedResponse += `- ${antonym}\n`;
    });
    formattedResponse += `\n`;
  }
  
  // Examples
  const examples = extractExamplesFromEntry(entry);
  if (examples.length > 0) {
    formattedResponse += `**Examples:**\n`;
    examples.slice(0, 3).forEach(example => {
      formattedResponse += `- ${example}\n`;
    });
    formattedResponse += `\n`;
  }
  
  // Etymology if available
  if (entry.origin) {
    formattedResponse += `**Etymology:**\n${entry.origin}\n\n`;
  }
  
  formattedResponse += `---\n`;
  formattedResponse += `*This result is from a free dictionary service. For better results with context-aware explanations, simplified phonetics, and ways to remember, please set at least one API key in the extension settings.*`;
  
  return formattedResponse;
}

// Extract synonyms from dictionary entry
function extractSynonymsFromEntry(entry) {
  const synonyms = [];
  
  if (entry.meanings) {
    entry.meanings.forEach(meaning => {
      if (meaning.synonyms) {
        synonyms.push(...meaning.synonyms);
      }
      if (meaning.definitions) {
        meaning.definitions.forEach(def => {
          if (def.synonyms) {
            synonyms.push(...def.synonyms);
          }
        });
      }
    });
  }
  
  // Remove duplicates and return
  return [...new Set(synonyms)];
}

// Extract antonyms from dictionary entry
function extractAntonymsFromEntry(entry) {
  const antonyms = [];
  
  if (entry.meanings) {
    entry.meanings.forEach(meaning => {
      if (meaning.antonyms) {
        antonyms.push(...meaning.antonyms);
      }
      if (meaning.definitions) {
        meaning.definitions.forEach(def => {
          if (def.antonyms) {
            antonyms.push(...def.antonyms);
          }
        });
      }
    });
  }
  
  // Remove duplicates and return
  return [...new Set(antonyms)];
}

// Extract examples from dictionary entry
function extractExamplesFromEntry(entry) {
  const examples = [];
  
  if (entry.meanings) {
    entry.meanings.forEach(meaning => {
      if (meaning.definitions) {
        meaning.definitions.forEach(def => {
          if (def.example) {
            examples.push(def.example);
          }
        });
      }
    });
  }
  
  return examples;
}

