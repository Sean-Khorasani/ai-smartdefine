// src/ui/extension_tabs.js

// ========== GLOBAL VARIABLES ==========
let currentTab = 'wordlist';
let currentCategory = 'all';
let wordLists = {};
let filteredWords = [];

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize tab switching
  initializeTabSwitching();
  
  // Initialize based on URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const tab = urlParams.get('tab');
  if (tab && ['wordlist', 'practice', 'settings'].includes(tab)) {
    switchTab(tab);
  }
  
  // Initialize all modules
  await initializeWordList();
  initializePractice();
  initializeSettings();
  
  console.log('SmartDefine Extension Tabs initialized');
});

// ========== TAB SWITCHING FUNCTIONALITY ==========
function initializeTabSwitching() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

async function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    }
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  const targetTab = document.getElementById(`${tabName}-tab`);
  if (targetTab) {
    targetTab.classList.add('active');
    currentTab = tabName;
    
    // Tab-specific initialization
    if (tabName === 'wordlist') {
      refreshWordList();
    } else if (tabName === 'practice') {
      // Ensure wordLists is loaded before initializing practice
      await loadWordLists();
      initializePracticeMode();
      // Set up event listeners when practice tab is accessed
      setupPracticeEventListeners();
    } else if (tabName === 'settings') {
      loadAllSettings();
    }
  }
}

// ========== WORD LIST TAB FUNCTIONALITY ==========
async function initializeWordList() {
  await loadWordLists();
  updateStats();
  renderCategoryTabs();
  renderWordList();
  
  // Event listeners for word list
  const searchBox = document.getElementById('searchBox');
  if (searchBox) {
    searchBox.addEventListener('input', handleSearch);
  }
  
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', showAddCategoryModal);
  }
  
  const exportAllBtn = document.getElementById('exportAllBtn');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', exportAll);
  }
  
  // Event delegation for word action buttons
  const wordsList = document.getElementById('wordsList');
  if (wordsList) {
    wordsList.addEventListener('click', handleWordAction);
  }
}

// Load word lists from storage
async function loadWordLists() {
  try {
    // Check if browser API is available
    if (typeof browser === 'undefined') {
      console.warn('Browser API not available, using empty wordLists');
      wordLists = {};
      filterWords();
      return;
    }
    
    const storage = await browser.storage.local.get(['wordLists']);
    wordLists = storage.wordLists || {};
    console.log('Loaded wordLists:', wordLists);
    filterWords();
  } catch (error) {
    console.error('Error loading word lists:', error);
    wordLists = {};
  }
}

// Filter words based on current category and search
function filterWords() {
  const searchBox = document.getElementById('searchBox');
  const searchTerm = searchBox ? searchBox.value.toLowerCase() : '';
  filteredWords = [];

  if (currentCategory === 'all') {
    // Include all words from all categories
    Object.keys(wordLists).forEach(category => {
      if (wordLists[category]) {
        wordLists[category].forEach(word => {
          if (word.word.toLowerCase().includes(searchTerm)) {
            filteredWords.push({ ...word, category });
          }
        });
      }
    });
  } else {
    // Include words from specific category
    if (wordLists[currentCategory]) {
      wordLists[currentCategory].forEach(word => {
        if (word.word.toLowerCase().includes(searchTerm)) {
          filteredWords.push({ ...word, category: currentCategory });
        }
      });
    }
  }

  // Sort by date added (newest first)
  filteredWords.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
}

// Update statistics
async function updateStats() {
  try {
    // Get stats from background learning engine
    const response = await browser.runtime.sendMessage({
      command: "getStudyStats"
    });
    
    if (response && response.success) {
      const stats = response.stats;
      updateStatsDisplay(stats);
      
      // Update overdue badge
      await browser.runtime.sendMessage({ command: "updateOverdueBadge" });
    } else {
      // Fallback to local calculation
      updateStatsLocal();
    }
  } catch (error) {
    console.error('Error getting stats from background:', error);
    updateStatsLocal();
  }
}

function updateStatsDisplay(stats) {
  const elements = {
    totalWords: document.getElementById('totalWords'),
    masteredWords: document.getElementById('masteredWords'),
    learningWords: document.getElementById('learningWords'),
    newWords: document.getElementById('newWords')
  };
  
  if (elements.totalWords) elements.totalWords.textContent = stats.totalWords || 0;
  if (elements.masteredWords) elements.masteredWords.textContent = stats.masteredWords || 0;
  if (elements.learningWords) elements.learningWords.textContent = stats.learningWords || 0;
  if (elements.newWords) elements.newWords.textContent = stats.newWords || 0;
}

// Fallback local stats calculation
function updateStatsLocal() {
  let totalWords = 0;
  let masteredWords = 0;
  let learningWords = 0;
  let newWords = 0;

  Object.values(wordLists).forEach(category => {
    if (Array.isArray(category)) {
      category.forEach(word => {
        totalWords++;
        switch (word.difficulty) {
          case 'mastered':
            masteredWords++;
            break;
          case 'learning':
            learningWords++;
            break;
          case 'new':
          default:
            newWords++;
            break;
        }
      });
    }
  });

  updateStatsDisplay({
    totalWords,
    masteredWords,
    learningWords,
    newWords
  });
}

// Render category tabs
function renderCategoryTabs() {
  const categoryTabs = document.getElementById('categoryTabs');
  if (!categoryTabs) return;
  
  categoryTabs.innerHTML = '';
  
  // Count words in each category
  const categoryCounts = { all: 0 };
  Object.keys(wordLists).forEach(category => {
    const count = wordLists[category] ? wordLists[category].length : 0;
    categoryCounts[category] = count;
    categoryCounts.all += count;
  });
  
  // Create "All Words" tab
  const allTab = document.createElement('div');
  allTab.className = `category-tab ${currentCategory === 'all' ? 'active' : ''}`;
  allTab.setAttribute('data-category', 'all');
  allTab.textContent = `All Words (${categoryCounts.all})`;
  allTab.addEventListener('click', () => switchCategory('all'));
  categoryTabs.appendChild(allTab);
  
  // Create category tabs
  Object.keys(wordLists).forEach(category => {
    const tab = document.createElement('div');
    tab.className = `category-tab ${currentCategory === category ? 'active' : ''}`;
    tab.setAttribute('data-category', category);
    tab.textContent = `${category.charAt(0).toUpperCase() + category.slice(1)} (${categoryCounts[category]})`;
    tab.addEventListener('click', () => switchCategory(category));
    categoryTabs.appendChild(tab);
  });
}

// Switch category
function switchCategory(category) {
  currentCategory = category;
  filterWords();
  renderCategoryTabs();
  renderWordList();
}

// Render word list
function renderWordList() {
  const wordsList = document.getElementById('wordsList');
  if (!wordsList) return;
  
  if (filteredWords.length === 0) {
    // Clear content
    wordsList.textContent = '';
    
    // Create empty state
    const emptyState = document.createElement('div');
    emptyState.style.cssText = 'text-align: center; padding: 40px; color: #999;';
    
    const emptyText = document.createElement('p');
    emptyText.textContent = currentCategory === 'all' ? 
      'No words found. Start by selecting and explaining words on any webpage!' : 
      'Try a different category or search term.';
    
    emptyState.appendChild(emptyText);
    wordsList.appendChild(emptyState);
    return;
  }
  
  wordsList.textContent = '';
  
  filteredWords.forEach(word => {
    const wordCard = createWordCard(word);
    wordsList.appendChild(wordCard);
  });
}

// Create word card element
function createWordCard(word) {
  const card = document.createElement('div');
  card.className = 'word-card';
  
  const formattedDate = new Date(word.dateAdded).toLocaleDateString();
  const explanation = word.explanation.length > 200 
    ? word.explanation.substring(0, 200) + '...' 
    : word.explanation;
  
  // Create word header
  const wordHeader = document.createElement('div');
  wordHeader.className = 'word-header';
  
  const wordTitle = document.createElement('div');
  wordTitle.className = 'word-title';
  wordTitle.textContent = word.word;
  
  const wordActions = document.createElement('div');
  wordActions.className = 'word-actions';
  
  // Create action buttons
  const viewBtn = document.createElement('button');
  viewBtn.className = 'word-btn word-action-btn';
  viewBtn.setAttribute('data-action', 'view');
  viewBtn.setAttribute('data-word', word.word);
  viewBtn.setAttribute('data-category', word.category);
  viewBtn.textContent = '👁️ View';
  
  const exportBtn = document.createElement('button');
  exportBtn.className = 'word-btn word-action-btn';
  exportBtn.setAttribute('data-action', 'export');
  exportBtn.setAttribute('data-word', word.word);
  exportBtn.setAttribute('data-category', word.category);
  exportBtn.textContent = '📤 Export';
  
  const flashcardBtn = document.createElement('button');
  flashcardBtn.className = 'word-btn word-action-btn';
  flashcardBtn.setAttribute('data-action', 'flashcard');
  flashcardBtn.setAttribute('data-word', word.word);
  flashcardBtn.setAttribute('data-category', word.category);
  flashcardBtn.textContent = '🃏 Flashcard';
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'word-btn word-action-btn';
  deleteBtn.setAttribute('data-action', 'delete');
  deleteBtn.setAttribute('data-word', word.word);
  deleteBtn.setAttribute('data-category', word.category);
  deleteBtn.style.color = '#f44336';
  deleteBtn.textContent = '🗑️ Delete';
  
  wordActions.appendChild(viewBtn);
  wordActions.appendChild(exportBtn);
  wordActions.appendChild(flashcardBtn);
  wordActions.appendChild(deleteBtn);
  
  wordHeader.appendChild(wordTitle);
  wordHeader.appendChild(wordActions);
  
  // Create explanation section
  const wordExplanation = document.createElement('div');
  wordExplanation.className = 'word-explanation';
  
  // Handle **bold** text by converting to DOM elements safely
  const parts = explanation.split(/\*\*(.*?)\*\*/g);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Regular text
      if (parts[i]) {
        wordExplanation.appendChild(document.createTextNode(parts[i]));
      }
    } else {
      // Bold text
      const strong = document.createElement('strong');
      strong.textContent = parts[i];
      wordExplanation.appendChild(strong);
    }
  }
  
  // Create meta section
  const wordMeta = document.createElement('div');
  wordMeta.className = 'word-meta';
  
  const categorySpan = document.createElement('span');
  categorySpan.textContent = `📁 ${word.category}`;
  
  const dateSpan = document.createElement('span');
  dateSpan.textContent = `📅 ${formattedDate}`;
  
  const difficultySpan = document.createElement('span');
  difficultySpan.textContent = `📊 ${word.difficulty || 'new'}`;
  
  wordMeta.appendChild(categorySpan);
  wordMeta.appendChild(dateSpan);
  wordMeta.appendChild(difficultySpan);
  
  // Assemble card
  card.appendChild(wordHeader);
  card.appendChild(wordExplanation);
  card.appendChild(wordMeta);
  
  return card;
}

// Handle search
function handleSearch() {
  filterWords();
  renderWordList();
}

// Handle word action button clicks (event delegation)
function handleWordAction(event) {
  const target = event.target.closest('.word-action-btn');
  if (!target) return;
  
  event.preventDefault();
  
  const action = target.getAttribute('data-action');
  const word = target.getAttribute('data-word');
  const category = target.getAttribute('data-category');
  
  switch (action) {
    case 'view':
      viewWord(word, category);
      break;
    case 'export':
      exportWord(word, category);
      break;
    case 'flashcard':
      showFlashcard(word, category);
      break;
    case 'delete':
      deleteWord(word, category);
      break;
  }
}

// Refresh word list
async function refreshWordList() {
  await loadWordLists();
  updateStats();
  renderCategoryTabs();
  renderWordList();
}

// Export all words
function exportAll() {
  if (filteredWords.length === 0) {
    alert('No words to export.');
    return;
  }
  
  showExportDialog(filteredWords, `smartdefine-words-${new Date().toISOString().split('T')[0]}`, false); // false = multiple words export
}

// Start flashcards
function startFlashcards() {
  if (filteredWords.length === 0) {
    alert('No words available for flashcards. Add some words first!');
    return;
  }
  
  // Switch to practice tab and start flashcard mode
  switchTab('practice');
  setTimeout(() => {
    startPractice('flashcard');
  }, 100);
}

// Format word explanation with proper HTML structure
function formatWordExplanation(explanation) {
  if (!explanation) return '';
  
  // Split explanation into sections
  const sections = explanation.split(/\*\*(.*?)\*\*/g);
  let formattedHtml = '';
  
  // Icons for different sections
  const sectionIcons = {
    'meaning': '💡',
    'definition': '💡',
    'phonetics': '🔊',
    'respelling': '🔊',
    'pronunciation': '🔊',
    'synonyms': '🔄',
    'antonyms': '↔️',
    'examples': '📝',
    'collocations': '🔗',
    'ways to remember': '🧠',
    'etymology': '📚',
    'notes': '📋'
  };
  
  for (let i = 0; i < sections.length; i++) {
    if (i % 2 === 0) {
      // Regular content
      if (sections[i].trim()) {
        formattedHtml += `<div style="margin-bottom: 15px;">${sections[i].trim().replace(/\n/g, '<br>')}</div>`;
      }
    } else {
      // Section header
      const sectionName = sections[i].toLowerCase().replace(':', '').trim();
      const icon = sectionIcons[sectionName] || '•';
      const nextContent = sections[i + 1] ? sections[i + 1].trim() : '';
      
      if (nextContent) {
        formattedHtml += `
          <div style="margin: 20px 0 15px 0;">
            <h3 style="margin: 0 0 10px 0; color: #4CAF50; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
              <span>${icon}</span>
              <span>${sections[i]}</span>
            </h3>
            <div style="margin-left: 25px; padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 3px solid #4CAF50;">
              ${formatSectionContent(nextContent, sectionName)}
            </div>
          </div>
        `;
        i++; // Skip the content part as we've already processed it
      }
    }
  }
  
  return formattedHtml;
}

// Extract meaningful definition from explanation for flashcards
function extractMeaningFromExplanation(explanation) {
  if (!explanation) return 'No explanation available';
  
  // Look for the "Meaning:" section first
  const meaningMatch = explanation.match(/\*\*Meaning:\*\*(.*?)(?=\*\*|$)/s);
  if (meaningMatch) {
    return meaningMatch[1].trim().replace(/\n/g, '<br>').replace(/\[([^\]]+)\]/g, '<em>$1</em>');
  }
  
  // If no "Meaning:" section, look for "Definition:"
  const definitionMatch = explanation.match(/\*\*Definition:\*\*(.*?)(?=\*\*|$)/s);
  if (definitionMatch) {
    return definitionMatch[1].trim().replace(/\n/g, '<br>').replace(/\[([^\]]+)\]/g, '<em>$1</em>');
  }
  
  // If it's from dictionary API, extract the main definition
  if (explanation.includes('Dictionary Definition')) {
    const dictMatch = explanation.match(/\*\*Meaning:\*\*(.*?)(?=\*\*|$)/s);
    if (dictMatch) {
      return dictMatch[1].trim().replace(/\n/g, '<br>');
    }
  }
  
  // Fallback: take the first meaningful paragraph
  const lines = explanation.split('\n').filter(line => line.trim() && !line.startsWith('*'));
  if (lines.length > 0) {
    return lines[0].replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').substring(0, 200) + (lines[0].length > 200 ? '...' : '');
  }
  
  // Last resort: show first 200 characters
  return explanation.substring(0, 200).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') + (explanation.length > 200 ? '...' : '');
}

// Format section content based on section type
function formatSectionContent(content, sectionType) {
  if (!content) return '';
  
  // Handle list items (lines starting with -)
  if (content.includes('\n-') || content.startsWith('-')) {
    const lines = content.split('\n').filter(line => line.trim());
    const listItems = lines.map(line => {
      if (line.trim().startsWith('-')) {
        return `<li style="margin-bottom: 5px;">${line.trim().substring(1).trim()}</li>`;
      }
      return line.trim() ? `<div style="margin-bottom: 8px;">${line.trim()}</div>` : '';
    }).filter(item => item);
    
    if (listItems.some(item => item.startsWith('<li'))) {
      return `<ul style="margin: 0; padding-left: 20px;">${listItems.join('')}</ul>`;
    } else {
      return listItems.join('');
    }
  }
  
  // Handle regular content
  return content.replace(/\n/g, '<br>').replace(/\[([^\]]+)\]/g, '<em>$1</em>');
}

// Show export format selection dialog
function showExportDialog(wordsData, filename, isSingleWord = false) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); z-index: 10000; display: flex;
    justify-content: center; align-items: center;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white; padding: 30px; border-radius: 16px; max-width: 500px;
    width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  `;

  // Create export option buttons based on single word vs multiple words
  function createExportButton(format, icon, title, description) {
    const button = document.createElement('button');
    button.className = 'export-format-btn';
    button.setAttribute('data-format', format);
    button.style.cssText = 'padding: 20px; border: 2px solid #e0e0e0; border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; text-align: center;';
    
    const iconDiv = document.createElement('div');
    iconDiv.style.cssText = 'font-size: 24px; margin-bottom: 8px;';
    iconDiv.textContent = icon;
    
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'font-weight: 600; color: #333;';
    titleDiv.textContent = title;
    
    const descDiv = document.createElement('div');
    descDiv.style.cssText = 'font-size: 12px; color: #666;';
    descDiv.textContent = description;
    
    button.appendChild(iconDiv);
    button.appendChild(titleDiv);
    button.appendChild(descDiv);
    
    return button;
  }
  
  const exportButtons = [];
  
  if (isSingleWord) {
    // For single words: TXT, PDF, Flashcard
    exportButtons.push(createExportButton('txt', '📄', 'TXT', 'Plain text format'));
    exportButtons.push(createExportButton('pdf', '📃', 'PDF', 'Portable document'));
    exportButtons.push(createExportButton('flashcards', '🃏', 'Flashcard', 'Anki-ready format'));
  } else {
    // For multiple words: TXT, CSV, Flashcards, JSON
    exportButtons.push(createExportButton('txt', '📄', 'TXT', 'Plain text format'));
    exportButtons.push(createExportButton('csv', '📊', 'CSV', 'Spreadsheet format'));
    exportButtons.push(createExportButton('flashcards', '🃏', 'Flashcards', 'Anki-ready format'));
    exportButtons.push(createExportButton('json', '📋', 'JSON', 'Data format'));
  }

  // Create header section
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = 'text-align: center; margin-bottom: 25px;';
  
  const title = document.createElement('h2');
  title.style.cssText = 'margin: 0 0 10px 0; color: #333;';
  title.textContent = '📤 Export Format';
  
  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'color: #666; margin: 0;';
  subtitle.textContent = 'Choose your preferred export format';
  
  headerDiv.appendChild(title);
  headerDiv.appendChild(subtitle);
  
  // Create options grid
  const optionsGrid = document.createElement('div');
  optionsGrid.style.cssText = `display: grid; grid-template-columns: ${isSingleWord ? 'repeat(3, 1fr)' : '1fr 1fr'}; gap: 15px; margin-bottom: 25px;`;
  
  // Add export buttons to grid
  exportButtons.forEach(button => {
    optionsGrid.appendChild(button);
  });
  
  // Create button section
  const buttonDiv = document.createElement('div');
  buttonDiv.style.cssText = 'display: flex; gap: 15px; justify-content: center;';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-export-btn';
  cancelBtn.style.cssText = 'padding: 12px 24px; border: 1px solid #ddd; border-radius: 8px; background: white; color: #666; cursor: pointer;';
  cancelBtn.textContent = 'Cancel';
  
  buttonDiv.appendChild(cancelBtn);
  
  // Assemble dialog
  dialog.appendChild(headerDiv);
  dialog.appendChild(optionsGrid);
  dialog.appendChild(buttonDiv);

  // Add event listeners
  dialog.querySelectorAll('.export-format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.getAttribute('data-format');
      modal.remove();
      performExport(wordsData, filename, format);
    });
    
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = '#4CAF50';
      btn.style.backgroundColor = '#f8fffe';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = '#e0e0e0';
      btn.style.backgroundColor = 'white';
    });
  });

  dialog.querySelector('.cancel-export-btn').addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  modal.appendChild(dialog);
  document.body.appendChild(modal);
}

// Perform export in specified format
function performExport(wordsData, filename, format) {
  let content, mimeType, extension;
  
  switch (format) {
    case 'txt':
      content = generateTxtExport(wordsData);
      mimeType = 'text/plain';
      extension = 'txt';
      break;
      
    case 'csv':
      content = generateCsvExport(wordsData);
      mimeType = 'text/csv';
      extension = 'csv';
      break;
      
    case 'flashcards':
      generateFlashcardsExport(wordsData, filename);
      return; // Flashcard generation handles display internally
      
    case 'pdf':
      generatePdfExport(wordsData, filename);
      return; // PDF generation handles display internally
      
    case 'json':
      content = generateJsonExport(wordsData);
      mimeType = 'application/json';
      extension = 'json';
      break;
      
    default:
      content = generateTxtExport(wordsData);
      mimeType = 'text/plain';
      extension = 'txt';
  }
  
  // Create and download file
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Generate TXT export
function generateTxtExport(wordsData) {
  let exportText = 'SmartDefine - Word List Export\n';
  exportText += '================================\n\n';
  
  wordsData.forEach(word => {
    exportText += `Word: ${word.word}\n`;
    exportText += `Category: ${word.category}\n`;
    exportText += `Date Added: ${new Date(word.dateAdded).toLocaleDateString()}\n`;
    exportText += `Difficulty: ${word.difficulty || 'new'}\n\n`;
    exportText += `Explanation:\n${word.explanation}\n\n`;
    if (word.notes) {
      exportText += `Notes:\n${word.notes}\n\n`;
    }
    exportText += '---\n\n';
  });
  
  return exportText;
}

// Generate CSV export
function generateCsvExport(wordsData) {
  let csv = 'Word,Category,Date Added,Difficulty,Explanation,Notes\n';
  
  wordsData.forEach(word => {
    const explanation = word.explanation.replace(/"/g, '""').replace(/\n/g, ' ');
    const notes = (word.notes || '').replace(/"/g, '""').replace(/\n/g, ' ');
    
    csv += `"${word.word}","${word.category}","${new Date(word.dateAdded).toLocaleDateString()}","${word.difficulty || 'new'}","${explanation}","${notes}"\n`;
  });
  
  return csv;
}

// Generate Flashcards export (Interactive format)
function generateFlashcardsExport(wordsData, filename) {
  // Create an interactive HTML page with flashcard display
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>SmartDefine - ${filename} - Flashcards</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f8f9fa;
            color: #333;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 20px;
            margin-bottom: 30px;
            background: white;
            border-radius: 8px;
            padding: 20px;
        }
        .flashcard {
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            border: 1px solid #e1e5e9;
            cursor: pointer;
            transition: all 0.3s ease;
            min-height: 200px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            position: relative;
        }
        .flashcard:hover {
            box-shadow: 0 8px 16px rgba(0,0,0,0.15);
            transform: translateY(-2px);
        }
        .flashcard.flipped {
            background: #f0f8f0;
        }
        .flashcard-front {
            text-align: center;
        }
        .flashcard-back {
            display: none;
        }
        .flashcard.flipped .flashcard-front {
            display: none;
        }
        .flashcard.flipped .flashcard-back {
            display: block;
        }
        .word-title {
            font-size: 32px;
            font-weight: 600;
            color: #4CAF50;
            margin-bottom: 20px;
        }
        .word-content {
            font-size: 16px;
            line-height: 1.8;
            text-align: left;
        }
        .flip-hint {
            position: absolute;
            top: 10px;
            right: 15px;
            font-size: 12px;
            color: #666;
            background: #f8f9fa;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .instructions {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
            color: #1976d2;
        }
        .anki-format {
            background: #fff3e0;
            padding: 15px;
            border-radius: 8px;
            margin-top: 30px;
            border-left: 4px solid #ff9800;
        }
        .anki-content {
            font-family: monospace;
            white-space: pre-wrap;
            background: white;
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
            max-height: 200px;
            overflow-y: auto;
        }
        @media print {
            body { background: white; }
            .flashcard { page-break-inside: avoid; }
            .instructions { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🃏 SmartDefine Flashcards</h1>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
        <p>Total cards: ${wordsData.length}</p>
    </div>
    
    <div class="instructions">
        <strong>💡 Click on any flashcard to flip and reveal the definition!</strong>
    </div>
    
    ${wordsData.map((word, index) => `
        <div class="flashcard" data-index="${index}">
            <div class="flip-hint">Click to flip</div>
            <div class="flashcard-front">
                <div class="word-title">${word.word}</div>
                <p style="color: #666;">Think about the definition...</p>
            </div>
            <div class="flashcard-back">
                <div class="word-title">${word.word}</div>
                <div class="word-content">${formatWordExplanation(word.explanation)}</div>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
                    <strong>Category:</strong> ${word.category} | 
                    <strong>Added:</strong> ${new Date(word.dateAdded).toLocaleDateString()}
                </div>
            </div>
        </div>
    `).join('')}
    
    <div class="anki-format">
        <h3>📋 Anki Import Format</h3>
        <p>Copy the text below and import it into Anki (File → Import):</p>
        <div class="anki-content">${wordsData.map(word => {
          const front = word.word;
          const back = word.explanation.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
          return `${front}\t${back}`;
        }).join('\n')}</div>
    </div>

    <script>
        // Set up event listeners when page loads
        document.addEventListener('DOMContentLoaded', () => {
            // Add click listeners to all flashcards
            const flashcards = document.querySelectorAll('.flashcard');
            flashcards.forEach(card => {
                card.addEventListener('click', () => {
                    card.classList.toggle('flipped');
                });
            });
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                const flashcards = document.querySelectorAll('.flashcard');
                const firstUnflipped = Array.from(flashcards).find(card => !card.classList.contains('flipped'));
                if (firstUnflipped) {
                    firstUnflipped.click();
                }
                e.preventDefault();
            }
        });
    </script>
</body>
</html>`;

  // Open new window with the flashcard content
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.create) {
    browser.tabs.create({ url }).then(() => {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  } else {
    const newWindow = window.open(url, '_blank');
    if (newWindow) {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }
}

// Generate JSON export
function generateJsonExport(wordsData) {
  return JSON.stringify(wordsData, null, 2);
}

// Generate PDF export
function generatePdfExport(wordsData, filename) {
  // Create a simple HTML page that can be printed to PDF
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>SmartDefine - ${filename}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .word-entry {
            margin-bottom: 30px;
            border: 1px solid #e1e5e9;
            border-radius: 8px;
            padding: 20px;
            background: #f8f9fa;
        }
        .word-title {
            font-size: 24px;
            font-weight: 600;
            color: #4CAF50;
            margin-bottom: 15px;
        }
        .word-content {
            font-size: 14px;
            line-height: 1.8;
        }
        .word-meta {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
        }
        @media print {
            body { margin: 0; padding: 10mm; }
            .word-entry { page-break-inside: avoid; }
            #printBtn { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚡ SmartDefine Word Export</h1>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
        <p>Total words: ${wordsData.length}</p>
        <button id="printBtn" onclick="window.print();" style="background: #4CAF50; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; margin-top: 15px;">
            🖨️ Print to PDF
        </button>
    </div>
    
    ${wordsData.map(word => `
        <div class="word-entry">
            <div class="word-title">${word.word}</div>
            <div class="word-content">${formatWordExplanation(word.explanation)}</div>
            <div class="word-meta">
                <strong>Category:</strong> ${word.category} | 
                <strong>Added:</strong> ${new Date(word.dateAdded).toLocaleDateString()} | 
                <strong>Difficulty:</strong> ${word.difficulty || 'new'}
            </div>
        </div>
    `).join('')}
    
</body>
</html>`;

  // Open new window and write the content directly so scripts are allowed
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.addEventListener('load', () => {
      const btn = printWindow.document.getElementById('printBtn');
      if (btn) {
        btn.addEventListener('click', () => printWindow.print());
      }
      printWindow.print();
      setTimeout(() => printWindow.close(), 1000);
    });
  }
}

// Show add category modal
function showAddCategoryModal() {
  const categoryName = prompt('Enter new category name:');
  if (categoryName && categoryName.trim()) {
    const trimmedName = categoryName.trim().toLowerCase();
    if (!wordLists[trimmedName]) {
      wordLists[trimmedName] = [];
      browser.storage.local.set({ wordLists });
      renderCategoryTabs();
    } else {
      alert('Category already exists!');
    }
  }
}

// Show flashcard modal for a specific word
function showFlashcard(word, category) {
  const wordData = wordLists[category]?.find(w => w.word === word);
  if (!wordData) return;

  // Create flashcard modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); z-index: 10000; display: flex;
    justify-content: center; align-items: center;
  `;

  const flashcard = document.createElement('div');
  flashcard.style.cssText = `
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    color: white; padding: 40px; border-radius: 16px; max-width: 500px;
    min-height: 300px; display: flex; flex-direction: column;
    justify-content: center; align-items: center; text-align: center;
    cursor: pointer; transition: transform 0.3s ease;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  `;

  let isFlipped = false;
  
  function updateFlashcard() {
    // Clear flashcard content
    flashcard.textContent = '';
    
    if (!isFlipped) {
      // Front side - show word
      const title = document.createElement('h1');
      title.style.cssText = 'font-size: 48px; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);';
      title.textContent = wordData.word;
      
      const instruction = document.createElement('p');
      instruction.style.cssText = 'font-size: 16px; opacity: 0.9; margin-bottom: 30px;';
      instruction.textContent = 'Click to reveal definition';
      
      const closeContainer = document.createElement('div');
      closeContainer.style.cssText = 'position: absolute; top: 20px; right: 20px;';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-flashcard-btn';
      closeBtn.style.cssText = 'background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer;';
      closeBtn.textContent = '✕';
      closeContainer.appendChild(closeBtn);
      
      const pronounceContainer = document.createElement('div');
      pronounceContainer.style.cssText = 'position: absolute; top: 20px; left: 20px;';
      const pronounceBtn = document.createElement('button');
      pronounceBtn.className = 'pronunciation-flashcard-btn';
      pronounceBtn.style.cssText = 'background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer;';
      pronounceBtn.textContent = '🔊';
      pronounceContainer.appendChild(pronounceBtn);
      
      flashcard.appendChild(title);
      flashcard.appendChild(instruction);
      flashcard.appendChild(closeContainer);
      flashcard.appendChild(pronounceContainer);
    } else {
      // Back side - show definition
      const explanation = extractMeaningFromExplanation(wordData.explanation);
      
      const title = document.createElement('h2');
      title.style.cssText = 'font-size: 24px; margin-bottom: 20px; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);';
      title.textContent = wordData.word;
      
      const explanationDiv = document.createElement('div');
      explanationDiv.style.cssText = 'font-size: 16px; line-height: 1.6; margin-bottom: 30px; max-height: 200px; overflow-y: auto;';
      explanationDiv.textContent = explanation;
      
      const instruction = document.createElement('p');
      instruction.style.cssText = 'font-size: 14px; opacity: 0.9;';
      instruction.textContent = 'Click to flip back';
      
      const closeContainer = document.createElement('div');
      closeContainer.style.cssText = 'position: absolute; top: 20px; right: 20px;';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-flashcard-btn';
      closeBtn.style.cssText = 'background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer;';
      closeBtn.textContent = '✕';
      closeContainer.appendChild(closeBtn);
      
      flashcard.appendChild(title);
      flashcard.appendChild(explanationDiv);
      flashcard.appendChild(instruction);
      flashcard.appendChild(closeContainer);
    }
    
    // Add event listeners
    const closeBtn = flashcard.querySelector('.close-flashcard-btn');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      modal.remove();
    });
    
    const pronunciationBtn = flashcard.querySelector('.pronunciation-flashcard-btn');
    if (pronunciationBtn) {
      pronunciationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playPronunciation(wordData.word, wordData.explanation);
      });
    }
  }

  // Initial render
  updateFlashcard();

  // Flip functionality
  flashcard.addEventListener('click', (e) => {
    if (e.target === flashcard || e.target.tagName === 'H1' || e.target.tagName === 'H2' || e.target.tagName === 'DIV' || e.target.tagName === 'P') {
      isFlipped = !isFlipped;
      flashcard.style.transform = 'scale(0.95)';
      setTimeout(() => {
        updateFlashcard();
        flashcard.style.transform = 'scale(1)';
      }, 150);
    }
  });

  modal.appendChild(flashcard);
  document.body.appendChild(modal);

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Word actions (these need to be global for onclick handlers)
window.viewWord = async function(word, category) {
  // Find the word data
  const wordData = wordLists[category]?.find(w => w.word === word);
  if (!wordData) return;
  
  // Create and show modal (simplified version)
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); z-index: 10000; display: flex;
    justify-content: center; align-items: center;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white; padding: 30px; border-radius: 16px; max-width: 600px;
    max-height: 80vh; overflow-y: auto; position: relative;
  `;
  
  // Create header section
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid #f0f0f0; padding-bottom: 15px;';
  
  const title = document.createElement('h1');
  title.style.cssText = 'margin: 0; color: #2c3e50; font-size: 28px; font-weight: 600;';
  title.textContent = wordData.word;
  
  const buttonsDiv = document.createElement('div');
  buttonsDiv.style.cssText = 'display: flex; gap: 10px;';
  
  const pronunciationBtn = document.createElement('button');
  pronunciationBtn.className = 'pronunciation-btn';
  pronunciationBtn.style.cssText = 'padding: 10px 14px; border: none; border-radius: 8px; background: #4CAF50; color: white; cursor: pointer; font-size: 16px; transition: all 0.2s;';
  pronunciationBtn.textContent = '🔊';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-modal-btn';
  closeBtn.style.cssText = 'padding: 10px 14px; border: none; border-radius: 8px; background: #f44336; color: white; cursor: pointer; font-size: 16px; transition: all 0.2s;';
  closeBtn.textContent = '✕';
  
  buttonsDiv.appendChild(pronunciationBtn);
  buttonsDiv.appendChild(closeBtn);
  headerDiv.appendChild(title);
  headerDiv.appendChild(buttonsDiv);
  
  // Create explanation section
  const explanationDiv = document.createElement('div');
  explanationDiv.style.cssText = 'line-height: 1.8; color: #333; font-size: 15px;';
  const formattedExplanation = formatWordExplanation(wordData.explanation);
  const parser = new DOMParser();
  const parsedExplanation = parser.parseFromString(formattedExplanation, 'text/html');
  parsedExplanation.body.childNodes.forEach(node => {
    explanationDiv.appendChild(node.cloneNode(true));
  });
  
  content.appendChild(headerDiv);
  content.appendChild(explanationDiv);
  
  // Add context section if available
  if (wordData.context) {
    const contextDiv = document.createElement('div');
    contextDiv.style.cssText = 'margin-top: 25px; padding: 20px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; border-left: 5px solid #4CAF50; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
    
    const contextTitle = document.createElement('h4');
    contextTitle.style.cssText = 'margin: 0 0 10px 0; color: #4CAF50; font-size: 16px;';
    contextTitle.textContent = '📝 Context';
    
    const contextContent = document.createElement('div');
    contextContent.style.cssText = 'font-style: italic; color: #555;';
    
    if (wordData.context.fullSentence) {
      contextContent.textContent = wordData.context.fullSentence;
    } else {
      contextContent.appendChild(document.createTextNode(`...${wordData.context.before} `));
      const strongWord = document.createElement('strong');
      strongWord.style.color = '#4CAF50';
      strongWord.textContent = wordData.word;
      contextContent.appendChild(strongWord);
      contextContent.appendChild(document.createTextNode(` ${wordData.context.after}...`));
    }
    
    contextDiv.appendChild(contextTitle);
    contextDiv.appendChild(contextContent);
    content.appendChild(contextDiv);
  }
  
  // Create metadata section
  const metaDiv = document.createElement('div');
  metaDiv.style.cssText = 'margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; font-size: 13px; color: #666; text-align: center;';
  
  const categoryLabel = document.createElement('strong');
  categoryLabel.textContent = 'Category:';
  const addedLabel = document.createElement('strong');
  addedLabel.textContent = 'Added:';
  const difficultyLabel = document.createElement('strong');
  difficultyLabel.textContent = 'Difficulty:';
  
  metaDiv.appendChild(categoryLabel);
  metaDiv.appendChild(document.createTextNode(` ${wordData.category} | `));
  metaDiv.appendChild(addedLabel);
  metaDiv.appendChild(document.createTextNode(` ${new Date(wordData.dateAdded).toLocaleDateString()} | `));
  metaDiv.appendChild(difficultyLabel);
  metaDiv.appendChild(document.createTextNode(` ${wordData.difficulty || 'new'}`));
  
  content.appendChild(metaDiv);
  
  modal.className = 'modal';
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Add event listeners
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  content.querySelector('.close-modal-btn').addEventListener('click', () => {
    modal.remove();
  });
  
  content.querySelector('.pronunciation-btn').addEventListener('click', () => {
    playPronunciation(wordData.word, wordData.explanation);
  });
};

window.exportWord = function(word, category) {
  const wordData = wordLists[category]?.find(w => w.word === word);
  if (!wordData) return;
  
  showExportDialog([wordData], `${wordData.word}-smartdefine`, true); // true = single word export
};

window.deleteWord = async function(word, category) {
  if (confirm(`Are you sure you want to delete "${word}"?`)) {
    const wordIndex = wordLists[category]?.findIndex(w => w.word === word);
    if (wordIndex !== -1) {
      wordLists[category].splice(wordIndex, 1);
      await browser.storage.local.set({ wordLists });
      refreshWordList();
    }
  }
};

// Pronunciation functionality
window.playPronunciation = async function(word, response) {
  try {
    const audioPlayed = await tryMerriamWebsterAudio(word);
    if (audioPlayed) return;
    playWebSpeechPronunciation(word, response);
  } catch (error) {
    playWebSpeechPronunciation(word, response);
  }
};

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

// ========== PRACTICE TAB FUNCTIONALITY ==========
function initializePractice() {
  // Set up practice button event listeners (CSP-safe)
  setupPracticeEventListeners();
  console.log('Practice tab initialized');
}

function setupPracticeEventListeners() {
  console.log('Setting up practice event listeners...');
  

  // Flashcard button
  const flashcardBtn = document.getElementById('flashcardBtn');
  if (flashcardBtn) {
    console.log('✓ Flashcard button found, adding event listener');
    flashcardBtn.addEventListener('click', async () => {
      try {
        await startPractice('flashcard');
      } catch (error) {
        console.error('Error starting flashcard practice:', error);
        showPracticeError(`Failed to start flashcard practice: ${error.message}`);
      }
    });
  }

  // Quiz button
  const quizBtn = document.getElementById('quizBtn');
  if (quizBtn) {
    console.log('✓ Quiz button found, adding event listener');
    quizBtn.addEventListener('click', async () => {
      try {
        await startPractice('quiz');
      } catch (error) {
        console.error('Error starting quiz practice:', error);
        showPracticeError(`Failed to start quiz practice: ${error.message}`);
      }
    });
  }

  // Typing button
  const typingBtn = document.getElementById('typingBtn');
  if (typingBtn) {
    console.log('✓ Typing button found, adding event listener');
    typingBtn.addEventListener('click', async () => {
      try {
        await startPractice('typing');
      } catch (error) {
        console.error('Error starting typing practice:', error);
        showPracticeError(`Failed to start typing practice: ${error.message}`);
      }
    });
  }
  
  console.log('Practice event listeners setup complete');
}

// Add diagnostic function to check practice readiness
async function checkPracticeReadiness() {
  console.log('=== Practice Diagnostic ===');
  
  // Ensure wordLists is loaded
  if (!wordLists || Object.keys(wordLists).length === 0) {
    await loadWordLists();
  }
  
  console.log('wordLists:', wordLists);
  
  const practiceWords = [];
  Object.keys(wordLists).forEach(category => {
    if (wordLists[category] && Array.isArray(wordLists[category])) {
      wordLists[category].forEach(word => {
        if (word && word.word && word.explanation) {
          practiceWords.push({ ...word, category });
        }
      });
    }
  });
  
  console.log(`Total practice words available: ${practiceWords.length}`);
  console.log('Practice words:', practiceWords.map(w => w.word));
  
  if (practiceWords.length === 0) {
    alert('⚠️ No words available for practice!\n\nTo use practice modes:\n1. Go to any webpage\n2. Select a word\n3. Right-click and choose "SmartDefine"\n4. The word will be saved for practice');
  } else {
    alert(`✅ Practice ready!\n\nFound ${practiceWords.length} words:\n${practiceWords.map(w => w.word).join(', ')}`);
  }
  
  return practiceWords;
}

function initializePracticeMode() {
  const modeSelector = document.getElementById('modeSelector');
  const practiceSession = document.getElementById('practiceSession');
  const completionScreen = document.getElementById('completionScreen');
  
  if (modeSelector) modeSelector.style.display = 'block';
  if (practiceSession) practiceSession.style.display = 'none';
  if (completionScreen) completionScreen.style.display = 'none';
}

async function startPractice(mode) {
  try {
    console.log(`Starting practice mode: ${mode}`);
    
    // Ensure wordLists is loaded
    if (!wordLists || Object.keys(wordLists).length === 0) {
      await loadWordLists();
    }
    
    // Get words for practice locally
    const practiceWords = [];
    Object.keys(wordLists).forEach(category => {
      if (wordLists[category] && Array.isArray(wordLists[category])) {
        wordLists[category].forEach(word => {
          if (word && word.word && word.explanation) {
            practiceWords.push({ ...word, category });
          }
        });
      }
    });
    
    console.log(`Found ${practiceWords.length} words for practice`);
    
    if (practiceWords.length > 0) {
      // Shuffle and limit to 10 words
      const shuffledWords = practiceWords.sort(() => Math.random() - 0.5).slice(0, 10);
      console.log(`Starting practice with ${shuffledWords.length} words`);
      initializePracticeSession(shuffledWords, mode);
    } else {
      console.log('No words available for practice');
      showPracticeError(`No words available for ${mode} practice. Please save some words first by explaining words on web pages!`);
    }
  } catch (error) {
    console.error('Error starting practice:', error);
    showPracticeError(`Error starting ${mode} practice session: ${error.message}`);
  }
}

// Generate practice content based on mode
function generatePracticeContent(currentWord, mode, progress, currentIndex, totalWords, isRevealed) {
  const progressBar = `
    <div style="margin-bottom: 20px;">
      <div style="background: #f0f0f0; border-radius: 20px; height: 8px; overflow: hidden;">
        <div style="background: #4CAF50; height: 100%; width: ${progress}%; transition: width 0.3s ease;"></div>
      </div>
      <p style="margin-top: 10px; color: #666;">Word ${currentIndex + 1} of ${totalWords}</p>
    </div>
  `;
  
  const exitButton = `
    <div style="margin-top: 20px;">
      <button id="exitPracticeBtn" style="padding: 8px 16px; border: 1px solid #ddd; border-radius: 6px; background: white; color: #666; cursor: pointer;">
        Exit Practice
      </button>
    </div>
  `;
  
  if (mode === 'flashcard') {
    return `
      <div style="text-align: center; padding: 30px;">
        ${progressBar}
        <div style="background: white; border-radius: 16px; padding: 40px; min-height: 300px; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 4px 16px rgba(0,0,0,0.1);">
          <h1 style="font-size: 36px; margin-bottom: 20px; color: #333;">${currentWord.word}</h1>
          
          ${!isRevealed ? `
            <p style="color: #666; margin-bottom: 30px;">Think about the definition, then click to reveal</p>
            <button id="revealDefinitionBtn" style="padding: 12px 24px; border: none; border-radius: 8px; background: #4CAF50; color: white; cursor: pointer; font-size: 16px;">
              Reveal Definition
            </button>
          ` : `
            <div style="margin-bottom: 30px; color: #333; line-height: 1.6;">
              ${extractMeaningFromExplanation(currentWord.explanation)}
            </div>
            
            <div style="display: flex; gap: 15px; justify-content: center;">
              <button id="markKnownBtn" style="padding: 12px 24px; border: none; border-radius: 8px; background: #4CAF50; color: white; cursor: pointer;">
                ✓ I knew this
              </button>
              <button id="markUnknownBtn" style="padding: 12px 24px; border: none; border-radius: 8px; background: #f44336; color: white; cursor: pointer;">
                ✗ I didn't know
              </button>
            </div>
          `}
        </div>
        ${exitButton}
      </div>
    `;
  }
  
  if (mode === 'quiz') {
    const meaning = extractMeaningFromExplanation(currentWord.explanation);
    const options = generateQuizOptions(currentWord, window.currentPracticeWords || []);
    
    return `
      <div style="text-align: center; padding: 30px;">
        ${progressBar}
        <div style="background: white; border-radius: 16px; padding: 40px; min-height: 300px; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 4px 16px rgba(0,0,0,0.1);">
          <h2 style="font-size: 18px; margin-bottom: 30px; color: #333;">What does this word mean?</h2>
          <h1 style="font-size: 36px; margin-bottom: 30px; color: #4CAF50;">${currentWord.word}</h1>
          
          <div style="display: flex; flex-direction: column; gap: 12px; max-width: 400px; margin: 0 auto;">
            ${options.map((option, index) => `
              <button id="quizOption${index}" class="quiz-option" data-correct="${option.correct}" data-index="${index}" style="
                padding: 15px 20px; border: 2px solid #e0e0e0; border-radius: 8px; background: white; 
                color: #333; cursor: pointer; text-align: left; transition: all 0.2s;
                font-size: 14px; line-height: 1.4;
              ">
                ${option.text}
              </button>
            `).join('')}
          </div>
        </div>
        ${exitButton}
      </div>
    `;
  }
  
  if (mode === 'typing') {
    const meaning = extractMeaningFromExplanation(currentWord.explanation);
    
    return `
      <div style="text-align: center; padding: 30px;">
        ${progressBar}
        <div style="background: white; border-radius: 16px; padding: 40px; min-height: 300px; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 4px 16px rgba(0,0,0,0.1);">
          <h2 style="font-size: 18px; margin-bottom: 20px; color: #333;">Type the word for this definition:</h2>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #4CAF50;">
            ${meaning}
          </div>
          
          <input type="text" id="typingInput" placeholder="Type the word here..." style="
            padding: 15px 20px; border: 2px solid #e0e0e0; border-radius: 8px; 
            font-size: 18px; text-align: center; margin-bottom: 20px; width: 100%; max-width: 300px; margin-left: auto; margin-right: auto;
          " autocomplete="off">
          
          <button id="checkTypingAnswerBtn" style="padding: 12px 24px; border: none; border-radius: 8px; background: #4CAF50; color: white; cursor: pointer; font-size: 16px;">
            Check Answer
          </button>
          
          <div id="typingFeedback" style="margin-top: 15px; font-size: 14px;"></div>
        </div>
        ${exitButton}
      </div>
    `;
  }
  
  return '<div>Unknown practice mode</div>';
}

// Generate quiz options (3 wrong + 1 correct)
function generateQuizOptions(correctWord, allWords) {
  const correctMeaning = extractMeaningFromExplanation(correctWord.explanation);
  const options = [{ text: correctMeaning, correct: true }];
  
  // Get available wrong answers
  const otherWords = allWords.filter(w => w.word !== correctWord.word);
  const availableWrong = Math.min(3, otherWords.length);
  const shuffled = otherWords.sort(() => Math.random() - 0.5).slice(0, availableWrong);
  
  shuffled.forEach(word => {
    options.push({ text: extractMeaningFromExplanation(word.explanation), correct: false });
  });
  
  // If we don't have enough words, add generic wrong options
  while (options.length < 4) {
    const genericOptions = [
      "A tool used for construction work",
      "A type of food preparation method", 
      "A mathematical calculation process",
      "A form of artistic expression",
      "A natural weather phenomenon",
      "A transportation method"
    ];
    
    const randomGeneric = genericOptions[Math.floor(Math.random() * genericOptions.length)];
    if (!options.some(opt => opt.text === randomGeneric)) {
      options.push({ text: randomGeneric, correct: false });
    }
  }
  
  // Shuffle all options
  return options.sort(() => Math.random() - 0.5);
}

function initializePracticeSession(words, mode) {
  console.log(`Initializing practice session: mode=${mode}, words=${words.length}`);
  
  const modeSelector = document.getElementById('modeSelector');
  const practiceSession = document.getElementById('practiceSession');
  
  if (modeSelector) modeSelector.style.display = 'none';
  if (practiceSession) practiceSession.style.display = 'block';
  
  // Store words globally for access in practice functions
  window.currentPracticeWords = words;
  
  // Start interactive practice session
  let currentWordIndex = 0;
  let score = 0;
  let isRevealed = false;
  
  function showCurrentWord() {
    const currentWord = words[currentWordIndex];
    const progress = Math.round(((currentWordIndex + 1) / words.length) * 100);
    
    console.log(`Showing word ${currentWordIndex + 1}/${words.length}: ${currentWord.word} (mode: ${mode})`);
    
    const content = generatePracticeContent(currentWord, mode, progress, currentWordIndex, words.length, isRevealed);
    practiceSession.textContent = '';
    const parser = new DOMParser();
    const parsedContent = parser.parseFromString(content, 'text/html');
    parsedContent.body.childNodes.forEach(node => {
      practiceSession.appendChild(node.cloneNode(true));
    });
    
    // Set up event listeners for the dynamically created buttons
    setupPracticeSessionEventListeners(mode, currentWord);
    
    // Focus on input for typing mode
    if (mode === 'typing') {
      setTimeout(() => {
        const input = document.getElementById('typingInput');
        if (input) input.focus();
      }, 100);
    }
  }
  
  function setupPracticeSessionEventListeners(mode, currentWord) {
    // Exit Practice button (common to all modes)
    const exitBtn = document.getElementById('exitPracticeBtn');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        initializePracticeMode();
      });
    }
    
    if (mode === 'flashcard') {
      // Reveal Definition button
      const revealBtn = document.getElementById('revealDefinitionBtn');
      if (revealBtn) {
        revealBtn.addEventListener('click', () => {
          isRevealed = true;
          showCurrentWord();
        });
      }
      
      // Mark Known/Unknown buttons
      const markKnownBtn = document.getElementById('markKnownBtn');
      if (markKnownBtn) {
        markKnownBtn.addEventListener('click', () => {
          markKnown(true);
        });
      }
      
      const markUnknownBtn = document.getElementById('markUnknownBtn');
      if (markUnknownBtn) {
        markUnknownBtn.addEventListener('click', () => {
          markKnown(false);
        });
      }
    }
    
    if (mode === 'quiz') {
      // Quiz option buttons
      for (let i = 0; i < 4; i++) {
        const optionBtn = document.getElementById(`quizOption${i}`);
        if (optionBtn) {
          optionBtn.addEventListener('click', () => {
            const index = parseInt(optionBtn.getAttribute('data-index'));
            selectQuizAnswer(index);
          });
        }
      }
    }
    
    if (mode === 'typing') {
      // Check Answer button
      const checkBtn = document.getElementById('checkTypingAnswerBtn');
      if (checkBtn) {
        checkBtn.addEventListener('click', () => {
          checkTypingAnswer();
        });
      }
      
      // Enter key support for typing input
      const typingInput = document.getElementById('typingInput');
      if (typingInput) {
        typingInput.addEventListener('keypress', (event) => {
          if (event.key === 'Enter') {
            checkTypingAnswer();
          }
        });
      }
    }
  }
  
  // Global functions for practice session
  window.revealDefinition = function() {
    isRevealed = true;
    showCurrentWord();
  };
  
  window.markKnown = function(known) {
    if (known) score++;
    
    currentWordIndex++;
    isRevealed = false;
    
    if (currentWordIndex >= words.length) {
      showResults();
    } else {
      showCurrentWord();
    }
  };
  
  // Quiz mode functions
  window.selectQuizAnswer = function(selectedIndex) {
    const options = document.querySelectorAll('.quiz-option');
    const selectedOption = options[selectedIndex];
    const isCorrect = selectedOption.getAttribute('data-correct') === 'true';
    
    // Disable all options
    options.forEach(option => {
      option.style.pointerEvents = 'none';
      if (option.getAttribute('data-correct') === 'true') {
        option.style.backgroundColor = '#4CAF50';
        option.style.color = 'white';
        option.style.borderColor = '#4CAF50';
      }
    });
    
    // Mark selected option
    if (isCorrect) {
      selectedOption.style.backgroundColor = '#4CAF50';
      selectedOption.style.color = 'white';
      selectedOption.style.borderColor = '#4CAF50';
      score++;
    } else {
      selectedOption.style.backgroundColor = '#f44336';
      selectedOption.style.color = 'white';
      selectedOption.style.borderColor = '#f44336';
    }
    
    // Continue after delay
    setTimeout(() => {
      currentWordIndex++;
      if (currentWordIndex >= words.length) {
        showResults();
      } else {
        showCurrentWord();
      }
    }, 2000);
  };
  
  // Typing mode functions
  window.checkTypingAnswer = function() {
    const input = document.getElementById('typingInput');
    const feedback = document.getElementById('typingFeedback');
    const userAnswer = input.value.trim().toLowerCase();
    const correctAnswer = words[currentWordIndex].word.toLowerCase();
    
    const isCorrect = userAnswer === correctAnswer;
    
    if (isCorrect) {
      feedback.textContent = '';
      const correctSpan = document.createElement('span');
      correctSpan.style.cssText = 'color: #4CAF50; font-weight: 600;';
      correctSpan.textContent = '✓ Correct!';
      feedback.appendChild(correctSpan);
      score++;
      input.style.borderColor = '#4CAF50';
      input.style.backgroundColor = '#f8fff8';
    } else {
      feedback.textContent = '';
      const incorrectSpan = document.createElement('span');
      incorrectSpan.style.cssText = 'color: #f44336; font-weight: 600;';
      incorrectSpan.appendChild(document.createTextNode('✗ Incorrect. The answer was: '));
      const strongAnswer = document.createElement('strong');
      strongAnswer.textContent = words[currentWordIndex].word;
      incorrectSpan.appendChild(strongAnswer);
      feedback.appendChild(incorrectSpan);
      input.style.borderColor = '#f44336';
      input.style.backgroundColor = '#fff8f8';
    }
    
    input.disabled = true;
    
    // Continue after delay
    setTimeout(() => {
      currentWordIndex++;
      if (currentWordIndex >= words.length) {
        showResults();
      } else {
        showCurrentWord();
      }
    }, 2500);
  };
  
  function showResults() {
    const percentage = Math.round((score / words.length) * 100);
    practiceSession.textContent = '';
    const resultsHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 16px rgba(0,0,0,0.1);">
          <h2 style="color: #4CAF50; margin-bottom: 20px;">🎉 Practice Complete!</h2>
          
          <div style="margin-bottom: 30px;">
            <div style="font-size: 48px; font-weight: bold; color: #4CAF50;">${percentage}%</div>
            <p style="color: #666;">You knew ${score} out of ${words.length} words</p>
          </div>
          
          <div style="display: flex; gap: 15px; justify-content: center;">
            <button id="practiceAgainBtn" style="padding: 12px 24px; border: none; border-radius: 8px; background: #4CAF50; color: white; cursor: pointer;">
              Practice Again
            </button>
            <button id="reviewWordsBtn" style="padding: 12px 24px; border: none; border-radius: 8px; background: #2196F3; color: white; cursor: pointer;">
              Review Words
            </button>
          </div>
        </div>
      </div>
    `;
    const parser = new DOMParser();
    const parsedResults = parser.parseFromString(resultsHTML, 'text/html');
    parsedResults.body.childNodes.forEach(node => {
      practiceSession.appendChild(node.cloneNode(true));
    });

    // Set up event listeners for completion screen buttons
    const practiceAgainBtn = document.getElementById('practiceAgainBtn');
    if (practiceAgainBtn) {
      practiceAgainBtn.addEventListener('click', () => {
        initializePracticeMode();
      });
    }
    
    const reviewWordsBtn = document.getElementById('reviewWordsBtn');
    if (reviewWordsBtn) {
      reviewWordsBtn.addEventListener('click', () => {
        switchTab('wordlist');
      });
    }
  }
  
  // Start the session
  showCurrentWord();
}

function showPracticeError(message) {
  const practiceContainer = document.querySelector('#practice-tab .practice-container');
  if (practiceContainer) {
    const errorHTML = `
      <div class="practice-card" style="display: block;">
        <div style="text-align: center; color: #f44336;">
          <h3>⚠️ Practice Unavailable</h3>
          <p>${message}</p>
          <button id="goToWordListBtn" style="padding: 12px 24px; border: none; border-radius: 8px; background: #4CAF50; color: white; cursor: pointer; margin-top: 20px;">
            Go to Word List
          </button>
        </div>
      </div>
    `;
    practiceContainer.textContent = '';
    const parser = new DOMParser();
    const parsedError = parser.parseFromString(errorHTML, 'text/html');
    parsedError.body.childNodes.forEach(node => {
      practiceContainer.appendChild(node.cloneNode(true));
    });
    
    // Add event listener after creating the button
    const goToWordListBtn = document.getElementById('goToWordListBtn');
    if (goToWordListBtn) {
      goToWordListBtn.addEventListener('click', () => {
        switchTab('wordlist');
      });
    }
  }
}

// ========== SETTINGS TAB FUNCTIONALITY ==========
function initializeSettings() {
  initializeCollapsibleSections();
  initializeProviders();
  initializeToggles();
  setupSaveSettings();
}

// Initialize collapsible sections functionality
function initializeCollapsibleSections() {
  const sectionHeaders = document.querySelectorAll('.section-header');
  
  sectionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const section = header.getAttribute('data-section');
      const content = document.getElementById(`${section}-section`);
      const expandBtn = header.querySelector('.expand-btn');
      
      if (content.classList.contains('show')) {
        // Collapse section
        content.classList.remove('show');
        expandBtn.textContent = '+';
      } else {
        // Expand section
        content.classList.add('show');
        expandBtn.textContent = '−';
      }
    });
  });
}

// Initialize provider selection functionality
function initializeProviders() {
  const providerCards = document.querySelectorAll('.provider-card');
  const apiConfigPanel = document.getElementById('apiConfigPanel');
  
  let selectedProvider = null;
  
  // Provider card selection
  providerCards.forEach(card => {
    card.addEventListener('click', () => {
      // Remove selected class from all cards
      providerCards.forEach(c => c.classList.remove('selected'));
      
      // Add selected class to clicked card
      card.classList.add('selected');
      
      // Get provider info
      const provider = card.getAttribute('data-provider');
      selectedProvider = provider;
      
      // Show config panel
      if (apiConfigPanel) {
        apiConfigPanel.classList.add('show');
        loadProviderConfig(provider);
      }
    });
  });
}

// Load provider configuration
async function loadProviderConfig(provider) {
  try {
    const storage = await browser.storage.local.get(['providers']);
    const providers = storage.providers || {};
    const config = providers[provider] || {};
    
    const baseUrlInput = document.getElementById('configBaseUrl');
    const modelInput = document.getElementById('configModel');
    const apiKeyInput = document.getElementById('configApiKey');
    const enabledCheckbox = document.getElementById('configProviderEnabled');

    if (baseUrlInput) baseUrlInput.value = config.baseUrl || '';
    if (modelInput) modelInput.value = config.model || '';
    if (apiKeyInput) apiKeyInput.value = config.apiKey || '';

    if (enabledCheckbox) {
      enabledCheckbox.checked = !!config.enabled;
      const updateState = () => {
        const hasKey = apiKeyInput && apiKeyInput.value.trim() !== '';
        enabledCheckbox.disabled = !hasKey;
        if (!hasKey) enabledCheckbox.checked = false;
      };
      updateState();
      if (apiKeyInput) {
        apiKeyInput.addEventListener('input', updateState);
      }
    }
  } catch (error) {
    console.error('Error loading provider config:', error);
  }
}

// Initialize toggle switches
function initializeToggles() {
  const toggleElements = document.querySelectorAll('.toggle');
  
  toggleElements.forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
    });
  });
}

// Load all settings from storage
async function loadAllSettings() {
  try {
    const storage = await browser.storage.local.get([
      'selectedProvider', 
      'prompt', 
      'providers', 
      'learningSettings'
    ]);
    
    // Load current provider display
    updateCurrentProviderDisplay(storage);
    
    // Load prompt
    const promptTextarea = document.getElementById('prompt');
    if (promptTextarea && storage.prompt) {
      promptTextarea.value = storage.prompt;
    }
    
    // Load learning settings and update toggles
    const learningSettings = storage.learningSettings || {};
    
    // Context-aware toggle
    const contextToggle = document.getElementById('contextAwareToggle');
    if (contextToggle && learningSettings.contextAwareDefinitions !== false) {
      contextToggle.classList.add('active');
    }
    
    // Auto-save toggle
    const autoSaveToggle = document.getElementById('saveToWordListToggle');
    if (autoSaveToggle && learningSettings.saveToWordList !== false) {
      autoSaveToggle.classList.add('active');
    }
    
    // Show save button toggle
    const showSaveToggle = document.getElementById('showSaveButtonToggle');
    if (showSaveToggle && learningSettings.showSaveButton !== false) {
      showSaveToggle.classList.add('active');
    }
    
    // Review reminders toggle
    const reviewToggle = document.getElementById('reviewRemindersToggle');
    if (reviewToggle && learningSettings.reviewReminders !== false) {
      reviewToggle.classList.add('active');
    }
    
    // Daily goal
    const dailyGoalInput = document.getElementById('dailyGoal');
    if (dailyGoalInput && learningSettings.dailyGoal) {
      dailyGoalInput.value = learningSettings.dailyGoal;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Update current provider display
function updateCurrentProviderDisplay(storage) {
  const currentProviderName = document.getElementById('currentProviderName');
  const currentProviderStatus = document.getElementById('currentProviderStatus');
  const currentProviderIcon = document.getElementById('currentProviderIcon');
  
  const selectedProvider = storage.selectedProvider || 'Not configured';
  const providers = storage.providers || {};
  const providerConfig = providers[selectedProvider] || {};
  
  if (currentProviderName) {
    currentProviderName.textContent = selectedProvider;
  }
  
  if (currentProviderIcon) {
    currentProviderIcon.textContent = selectedProvider === 'Together' ? '🔥' : 
                                      selectedProvider === 'OpenRouter' ? '🌐' : '🤖';
  }
  
  if (currentProviderStatus) {
    if (!providerConfig.apiKey) {
      currentProviderStatus.textContent = 'No API key set';
      currentProviderStatus.style.color = 'var(--text-muted)';
    } else if (providerConfig.enabled) {
      currentProviderStatus.textContent = 'Enabled ✓';
      currentProviderStatus.style.color = 'var(--primary-color)';
    } else {
      currentProviderStatus.textContent = 'Disabled';
      currentProviderStatus.style.color = 'var(--text-muted)';
    }
  }
}

// Setup save settings functionality
function setupSaveSettings() {
  const saveButton = document.getElementById('saveSettings');
  const statusMessage = document.getElementById('statusMessage');
  
  if (!saveButton) return;
  
  saveButton.addEventListener('click', async () => {
    try {
      // Show saving state
      saveButton.disabled = true;
      saveButton.textContent = '';
      const iconSpan = document.createElement('span');
      iconSpan.textContent = '💾';
      const textSpan = document.createElement('span');
      textSpan.textContent = 'Saving...';
      saveButton.appendChild(iconSpan);
      saveButton.appendChild(textSpan);
      
      // Collect all settings
      const settings = await collectAllSettings();
      
      // Validate settings
      const validation = validateSettings(settings);
      if (!validation.valid) {
        showStatus(validation.message, 'error');
        return;
      }
      
      // Save to storage
      await browser.storage.local.set(settings);
      
      // Update current provider display
      updateCurrentProviderDisplay({ 
        selectedProvider: settings.selectedProvider, 
        providers: settings.providers 
      });
      
      showStatus('Settings saved successfully!', 'success');
      
    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus('Failed to save settings', 'error');
    } finally {
      // Reset button
      saveButton.disabled = false;
      saveButton.textContent = '';
      const resetIconSpan = document.createElement('span');
      resetIconSpan.textContent = '💾';
      const resetTextSpan = document.createElement('span');
      resetTextSpan.textContent = 'Save Settings';
      saveButton.appendChild(resetIconSpan);
      saveButton.appendChild(resetTextSpan);
    }
  });
  
  // Show status message
  function showStatus(message, type = 'success') {
    if (!statusMessage) return;
    
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    
    setTimeout(() => {
      statusMessage.className = 'status-message';
    }, 3000);
  }
}

// Collect all settings from the UI
async function collectAllSettings() {
  // Get current storage to preserve existing data
  const currentStorage = await browser.storage.local.get([
    'selectedProvider', 
    'providers', 
    'learningSettings'
  ]);
  
  // Determine selected provider
  const selectedProviderCard = document.querySelector('.provider-card.selected');
  const selectedProvider = selectedProviderCard ? 
    selectedProviderCard.getAttribute('data-provider') : 
    currentStorage.selectedProvider || 'Together';
  
  // Get prompt
  const promptTextarea = document.getElementById('prompt');
  const prompt = promptTextarea ? promptTextarea.value.trim() : currentStorage.prompt;
  
  // Collect provider configurations
  const providers = currentStorage.providers || {};
  
  // Update config for currently selected provider if config panel is visible
  const apiConfigPanel = document.getElementById('apiConfigPanel');
  if (apiConfigPanel && apiConfigPanel.classList.contains('show') && selectedProviderCard) {
    const baseUrlInput = document.getElementById('configBaseUrl');
    const modelInput = document.getElementById('configModel');
    const apiKeyInput = document.getElementById('configApiKey');
    const enabledCheckbox = document.getElementById('configProviderEnabled');

    providers[selectedProvider] = {
      baseUrl: baseUrlInput ? baseUrlInput.value.trim() : '',
      model: modelInput ? modelInput.value.trim() : '',
      apiKey: apiKeyInput ? apiKeyInput.value.trim() : '',
      enabled: enabledCheckbox ? enabledCheckbox.checked : false
    };
  }
  
  // Collect learning settings
  const learningSettings = {
    ...currentStorage.learningSettings,
    contextAwareDefinitions: document.getElementById('contextAwareToggle')?.classList.contains('active') ?? true,
    saveToWordList: document.getElementById('saveToWordListToggle')?.classList.contains('active') ?? true,
    showSaveButton: document.getElementById('showSaveButtonToggle')?.classList.contains('active') ?? true,
    reviewReminders: document.getElementById('reviewRemindersToggle')?.classList.contains('active') ?? true,
    dailyGoal: parseInt(document.getElementById('dailyGoal')?.value) || 10
  };
  
  return {
    selectedProvider,
    prompt,
    providers,
    learningSettings
  };
}

// Validate settings before saving
function validateSettings(settings) {
  // Validate prompt
  if (!settings.prompt || !settings.prompt.includes('X_WORD_X')) {
    return {
      valid: false,
      message: "Prompt must include 'X_WORD_X' placeholder"
    };
  }
  
  return { valid: true };
}

// ========== UTILITY FUNCTIONS ==========

// Export functions to global scope for compatibility
window.switchTab = switchTab;
window.refreshWordList = refreshWordList;
window.loadAllSettings = loadAllSettings;
window.startPractice = startPractice;
window.checkPracticeReadiness = checkPracticeReadiness;
window.initializePracticeMode = initializePracticeMode;