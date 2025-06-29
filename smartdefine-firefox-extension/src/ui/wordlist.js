// src/ui/wordlist.js

document.addEventListener('DOMContentLoaded', async () => {
  let currentCategory = 'all';
  let wordLists = {};
  let filteredWords = [];

  // Load data and initialize
  await loadWordLists();
  updateStats();
  renderCategoryTabs();
  renderWordList();

  // Event listeners
  document.getElementById('closeBtn').addEventListener('click', closeTab);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('searchBox').addEventListener('input', handleSearch);
  document.getElementById('addCategoryBtn').addEventListener('click', showAddCategoryModal);
  document.getElementById('practiceBtn').addEventListener('click', startPractice);
  document.getElementById('flashcardsBtn').addEventListener('click', startFlashcards);
  document.getElementById('exportAllBtn').addEventListener('click', exportAll);

  // Load word lists from storage
  async function loadWordLists() {
    const storage = await browser.storage.local.get(['wordLists']);
    wordLists = storage.wordLists || {};
    filterWords();
  }

  // Filter words based on current category and search
  function filterWords() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    filteredWords = [];

    if (currentCategory === 'all') {
      // Include all words from all categories
      Object.keys(wordLists).forEach(category => {
        wordLists[category].forEach(word => {
          if (word.word.toLowerCase().includes(searchTerm) || 
              word.explanation.toLowerCase().includes(searchTerm) ||
              (word.notes && word.notes.toLowerCase().includes(searchTerm))) {
            filteredWords.push({ ...word, category });
          }
        });
      });
    } else {
      // Include words from specific category
      if (wordLists[currentCategory]) {
        wordLists[currentCategory].forEach(word => {
          if (word.word.toLowerCase().includes(searchTerm) || 
              word.explanation.toLowerCase().includes(searchTerm) ||
              (word.notes && word.notes.toLowerCase().includes(searchTerm))) {
            filteredWords.push({ ...word, category: currentCategory });
          }
        });
      }
    }

    // Sort by date added (newest first)
    filteredWords.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  }

  // Update statistics using background learning engine
  async function updateStats() {
    try {
      // Get stats from background learning engine
      const response = await browser.runtime.sendMessage({
        command: "getStudyStats"
      });
      
      if (response.success) {
        const stats = response.stats;
        document.getElementById('totalWords').textContent = stats.totalWords;
        document.getElementById('masteredWords').textContent = stats.masteredWords;
        document.getElementById('learningWords').textContent = stats.learningWords;
        document.getElementById('newWords').textContent = stats.newWords;
        
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

  // Fallback local stats calculation
  function updateStatsLocal() {
    let totalWords = 0;
    let masteredWords = 0;
    let learningWords = 0;
    let newWords = 0;

    Object.values(wordLists).forEach(category => {
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
    });

    document.getElementById('totalWords').textContent = totalWords;
    document.getElementById('masteredWords').textContent = masteredWords;
    document.getElementById('learningWords').textContent = learningWords;
    document.getElementById('newWords').textContent = newWords;
  }

  // Render category tabs
  function renderCategoryTabs() {
    const tabsContainer = document.getElementById('categoryTabs');
    const categories = Object.keys(wordLists);
    
    // Clear container
    tabsContainer.textContent = '';
    
    // Create "All Words" tab
    const allTab = document.createElement('div');
    allTab.className = `tab ${currentCategory === 'all' ? 'active' : ''}`;
    allTab.setAttribute('data-category', 'all');
    allTab.textContent = `All Words (${getTotalWordCount()})`;
    tabsContainer.appendChild(allTab);

    categories.forEach(category => {
      const count = wordLists[category].length;
      const categoryTab = document.createElement('div');
      categoryTab.className = `tab ${currentCategory === category ? 'active' : ''}`;
      categoryTab.setAttribute('data-category', category);
      categoryTab.textContent = `${category} (${count})`;
      tabsContainer.appendChild(categoryTab);
    });

    // Add click handlers to tabs
    tabsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab')) {
        currentCategory = e.target.dataset.category;
        filterWords();
        renderCategoryTabs();
        renderWordList();
      }
    });
  }

  // Get total word count across all categories
  function getTotalWordCount() {
    return Object.values(wordLists).reduce((total, category) => total + category.length, 0);
  }

  // Render word list
  function renderWordList() {
    const wordListContainer = document.getElementById('wordList');
    
    if (filteredWords.length === 0) {
      // Clear container
      wordListContainer.textContent = '';
      
      // Create empty state
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      
      const heading = document.createElement('h3');
      heading.textContent = currentCategory === 'all' ? 'No words saved yet' : `No words in ${currentCategory}`;
      
      const paragraph = document.createElement('p');
      paragraph.textContent = currentCategory === 'all' ? 
        'Start saving words by using the bookmark button when viewing explanations!' : 
        'Save some words to this category to see them here.';
      
      emptyState.appendChild(heading);
      emptyState.appendChild(paragraph);
      wordListContainer.appendChild(emptyState);
      return;
    }

    // Clear container
    wordListContainer.textContent = '';
    
    // Create word items
    filteredWords.forEach(word => {
      const meaning = extractMeaning(word.explanation);
      const dateAdded = new Date(word.dateAdded).toLocaleDateString();
      const difficultyClass = `difficulty-${word.difficulty}`;
      
      // Create word item container
      const wordItem = document.createElement('div');
      wordItem.className = 'word-item';
      wordItem.setAttribute('data-word', word.word);
      wordItem.setAttribute('data-category', word.category);
      if (word.provider) {
        wordItem.setAttribute('data-provider', word.provider);
      }
      
      // Create word content section
      const wordContent = document.createElement('div');
      wordContent.className = 'word-content';
      
      const wordTitle = document.createElement('div');
      wordTitle.className = 'word-title';
      wordTitle.textContent = word.word;
      
      const wordMeaning = document.createElement('div');
      wordMeaning.className = 'word-meaning';
      wordMeaning.textContent = meaning;
      
      const wordMeta = document.createElement('div');
      wordMeta.className = 'word-meta';
      
      // Add meta spans
      const dateSpan = document.createElement('span');
      dateSpan.textContent = `📅 ${dateAdded}`;
      wordMeta.appendChild(dateSpan);
      
      const categorySpan = document.createElement('span');
      categorySpan.textContent = `📂 ${word.category}`;
      wordMeta.appendChild(categorySpan);

      const providerSpan = document.createElement('span');
      providerSpan.textContent = `🔧 ${word.provider || 'Unknown'}`;
      wordMeta.appendChild(providerSpan);

      const statusSpan = document.createElement('span');
      statusSpan.className = `status-badge status-${word.status || 'new'}`;
      statusSpan.textContent = word.status || 'new';
      wordMeta.appendChild(statusSpan);
      
      const difficultySpan = document.createElement('span');
      difficultySpan.className = `difficulty-badge ${difficultyClass}`;
      difficultySpan.textContent = word.difficulty;
      wordMeta.appendChild(difficultySpan);
      
      if (word.reviewCount > 0) {
        const reviewSpan = document.createElement('span');
        reviewSpan.textContent = `🔁 Reviewed ${word.reviewCount} times`;
        wordMeta.appendChild(reviewSpan);
      }
      
      if (word.notes) {
        const notesSpan = document.createElement('span');
        notesSpan.textContent = '📝 Has notes';
        wordMeta.appendChild(notesSpan);
      }
      
      wordContent.appendChild(wordTitle);
      wordContent.appendChild(wordMeaning);
      wordContent.appendChild(wordMeta);
      
      // Create word actions section
      const wordActions = document.createElement('div');
      wordActions.className = 'word-actions';
      
      const viewBtn = document.createElement('button');
      viewBtn.className = 'action-btn review';
      viewBtn.setAttribute('data-word', word.word);
      viewBtn.setAttribute('data-category', word.category);
      if (word.provider) viewBtn.setAttribute('data-provider', word.provider);
      viewBtn.setAttribute('data-action', 'view');
      viewBtn.textContent = '👁️ View';
      
      const exportBtn = document.createElement('button');
      exportBtn.className = 'action-btn export';
      exportBtn.setAttribute('data-word', word.word);
      exportBtn.setAttribute('data-category', word.category);
      if (word.provider) exportBtn.setAttribute('data-provider', word.provider);
      exportBtn.setAttribute('data-action', 'export');
      exportBtn.textContent = '📤 Export';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-btn delete';
      deleteBtn.setAttribute('data-word', word.word);
      deleteBtn.setAttribute('data-category', word.category);
      if (word.provider) deleteBtn.setAttribute('data-provider', word.provider);
      deleteBtn.setAttribute('data-action', 'delete');
      deleteBtn.textContent = '🗑️ Delete';
      
      wordActions.appendChild(viewBtn);
      wordActions.appendChild(exportBtn);
      wordActions.appendChild(deleteBtn);
      
      // Assemble word item
      wordItem.appendChild(wordContent);
      wordItem.appendChild(wordActions);
      wordListContainer.appendChild(wordItem);
    });
    
    // Add event delegation for action buttons
    wordListContainer.addEventListener('click', handleWordAction);
  }

  // Handle word action button clicks
  function handleWordAction(event) {
    const button = event.target.closest('.action-btn');
    if (!button) return;

    const word = button.dataset.word;
    const category = button.dataset.category;
    const provider = button.dataset.provider || null;
    const action = button.dataset.action;

    if (!word || !category || !action) return;

    let wordData = wordLists[category]?.find(w => w.word === word && w.provider === provider);
    if (!wordData) {
      // Fallback to match without provider (for older entries)
      wordData = wordLists[category]?.find(w => w.word === word);
    }
    if (!wordData) {
      showMessage('Word not found!', 'error');
      return;
    }

    switch (action) {
      case 'view':
        showWordDetailsModal(wordData);
        break;
      case 'export':
        const format = prompt('Export format:\n1. PDF\n2. TXT\n3. Flashcard\nEnter number (1-3):');
        switch (format) {
          case '1':
            exportWordToPDF(wordData);
            break;
          case '2':
            exportWordToTXT(wordData);
            break;
          case '3':
            exportWordAsFlashcard(wordData);
            break;
          default:
            showMessage('Invalid format selected!', 'error');
        }
        break;
      case 'delete':
        if (confirm(`Are you sure you want to delete "${word}" from ${category}?`)) {
          const index = wordLists[category].findIndex(w => w.word === word && w.provider === provider);
          if (index !== -1) {
            wordLists[category].splice(index, 1);
            
            // Remove category if empty
            if (wordLists[category].length === 0) {
              delete wordLists[category];
            }
            
            saveWordLists();
            filterWords();
            renderCategoryTabs();
            renderWordList();
            showMessage(`"${word}" deleted successfully!`, 'success');
          }
        }
        break;
    }
  }

  // Extract meaning from explanation
  function extractMeaning(explanation) {
    // Try to extract the meaning section
    const lines = explanation.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toLowerCase().includes('meaning') && i + 1 < lines.length) {
        const meaningLine = lines[i + 1].trim();
        if (meaningLine && !meaningLine.toLowerCase().includes('respelling')) {
          return meaningLine.length > 100 ? meaningLine.substring(0, 100) + '...' : meaningLine;
        }
      }
    }
    // Fallback: return first non-empty line
    const firstLine = lines.find(line => line.trim().length > 0);
    return firstLine ? (firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine) : 'No definition available';
  }

  // Handle search
  function handleSearch() {
    filterWords();
    renderWordList();
  }

  // Show add category modal
  function showAddCategoryModal() {
    const categoryName = prompt('Enter new category name:');
    if (categoryName && categoryName.trim()) {
      const trimmedName = categoryName.trim();
      if (!wordLists[trimmedName]) {
        wordLists[trimmedName] = [];
        saveWordLists();
        renderCategoryTabs();
        showMessage(`Category "${trimmedName}" created successfully!`, 'success');
      } else {
        showMessage(`Category "${trimmedName}" already exists!`, 'error');
      }
    }
  }

  // Start practice mode with words due for review
  async function startPractice() {
    try {
      const response = await browser.runtime.sendMessage({
        command: "getWordsForReview",
        reviewType: "all",
        limit: 20
      });
      
      if (response.success && response.words.length > 0) {
        // Open practice mode in new tab
        browser.tabs.create({
          url: browser.runtime.getURL('src/ui/practice.html')
        });
      } else {
        showMessage('No words are due for review right now!', 'info');
      }
    } catch (error) {
      console.error('Error getting words for practice:', error);
      showMessage('Error starting practice mode!', 'error');
    }
  }

  // Start flashcards with words due for review
  async function startFlashcards() {
    try {
      const response = await browser.runtime.sendMessage({
        command: "getWordsForReview",
        reviewType: "all",
        limit: 10
      });
      
      if (response.success && response.words.length > 0) {
        // Open practice mode in flashcard mode
        browser.tabs.create({
          url: browser.runtime.getURL('src/ui/practice.html') + '?mode=flashcard'
        });
      } else {
        showMessage('No words are due for flashcard review right now!', 'info');
      }
    } catch (error) {
      console.error('Error getting words for flashcards:', error);
      showMessage('Error starting flashcard mode!', 'error');
    }
  }

  // Export all words
  function exportAll() {
    if (getTotalWordCount() === 0) {
      showMessage('No words to export!', 'error');
      return;
    }
    
    // Show export options
    const format = prompt('Export format:\n1. PDF\n2. CSV\n3. Anki\nEnter number (1-3):');
    
    switch (format) {
      case '1':
        exportToPDF(filteredWords);
        break;
      case '2':
        exportToCSV(filteredWords);
        break;
      case '3':
        exportToAnki(filteredWords);
        break;
      default:
        showMessage('Invalid format selected!', 'error');
    }
  }

  // Close tab function
  function closeTab() {
    window.close();
  }

  // Open settings with navigation context
  function openSettings() {
    browser.tabs.create({
      url: browser.runtime.getURL('src/ui/popup.html') + '?from=wordlist'
    });
  }

  // Save word lists to storage
  async function saveWordLists() {
    await browser.storage.local.set({ wordLists });
    updateStats();
  }

  // Show message
  function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      font-weight: 500;
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    `;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.remove();
    }, 3000);
  }

  // Export functions
  function exportToPDF(words) {
    // Create a simple HTML document for PDF conversion
    const htmlContent = generatePDFContent(words);

    // Open new window and write content directly to avoid CSP issues
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.addEventListener('load', () => {
        printWindow.print();
        setTimeout(() => printWindow.close(), 1000);
      });
    }

    showMessage('PDF export initiated! Use your browser\'s print dialog to save as PDF.', 'success');
  }

  function generatePDFContent(words) {
    const currentDate = new Date().toLocaleDateString();
    const totalWords = words.length;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SmartDefine Word List - ${currentDate}</title>
        <style>
          @media print {
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .no-print { display: none; }
            .page-break { page-break-before: always; }
          }
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #4CAF50; padding-bottom: 15px; }
          .header h1 { color: #4CAF50; margin: 0; font-size: 28px; }
          .header p { margin: 5px 0; color: #666; }
          .word-card { border: 1px solid #ddd; margin-bottom: 20px; padding: 15px; border-radius: 8px; }
          .word-title { font-size: 20px; font-weight: bold; color: #2196F3; margin-bottom: 10px; }
          .word-meta { font-size: 12px; color: #666; margin-bottom: 10px; }
          .word-explanation { margin-bottom: 10px; }
          .word-notes { background: #f8f9fa; padding: 10px; border-radius: 5px; margin-top: 10px; font-style: italic; }
          .stats { background: #f0f8f0; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📚 SmartDefine Word List</h1>
          <p>Generated on ${currentDate}</p>
          <p>Total Words: ${totalWords}</p>
        </div>
        
        <div class="stats">
          <strong>Export Summary:</strong><br>
          • New Words: ${words.filter(w => w.difficulty === 'new').length}<br>
          • Learning Words: ${words.filter(w => w.difficulty === 'learning').length}<br>
          • Mastered Words: ${words.filter(w => w.difficulty === 'mastered').length}
        </div>
        
        ${words.map((word, index) => `
          <div class="word-card">
            <div class="word-title">${word.word}</div>
            <div class="word-meta">
              Category: ${word.category} | 
              Added: ${new Date(word.dateAdded).toLocaleDateString()} | 
              Status: ${word.difficulty} | 
              Reviews: ${word.reviewCount || 0}
            </div>
            <div class="word-explanation">${cleanMarkdownForHTML(word.explanation)}</div>
            ${word.notes ? `<div class="word-notes"><strong>Notes:</strong> ${word.notes}</div>` : ''}
          </div>
          ${(index + 1) % 5 === 0 ? '<div class="page-break"></div>' : ''}
        `).join('')}
        
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #999;">
          Generated by SmartDefine Browser Extension
        </div>
      </body>
      </html>
    `;
  }

  function exportToCSV(words) {
    const csvContent = [
      ['Word', 'Meaning', 'Category', 'Notes', 'Date Added', 'Difficulty'].join(','),
      ...words.map(word => [
        `"${word.word}"`,
        `"${extractMeaning(word.explanation)}"`,
        `"${word.category}"`,
        `"${word.notes || ''}"`,
        `"${new Date(word.dateAdded).toLocaleDateString()}"`,
        `"${word.difficulty}"`
      ].join(','))
    ].join('\n');
    
    downloadFile(csvContent, 'smartdefine-words.csv', 'text/csv');
    showMessage('Words exported to CSV!', 'success');
  }

  function exportToAnki(words) {
    // Generate Anki-compatible TSV format
    const ankiContent = generateAnkiContent(words);
    downloadFile(ankiContent, 'smartdefine-anki-deck.txt', 'text/plain');
    showMessage(`${words.length} words exported to Anki format! Import the .txt file into Anki.`, 'success');
  }

  function generateAnkiContent(words) {
    // Anki basic format: Front\tBack\tTags
    const header = "# SmartDefine Anki Deck\n# Import this file into Anki\n# Format: Front\\tBack\\tTags\n\n";
    
    const ankiCards = words.map(word => {
      const front = word.word;
      const meaning = extractMeaning(word.explanation);
      const fullExplanation = word.explanation.replace(/\n/g, '<br>');
      
      // Create comprehensive back side
      const back = `
        <div style="font-family: Arial, sans-serif;">
          <div style="font-size: 16px; font-weight: bold; color: #2196F3; margin-bottom: 10px;">${meaning}</div>
          <div style="font-size: 14px; line-height: 1.5; margin-bottom: 15px;">${fullExplanation}</div>
          ${word.notes ? `<div style="background: #f0f0f0; padding: 10px; border-radius: 5px; font-style: italic;"><strong>Personal Notes:</strong> ${word.notes}</div>` : ''}
          <div style="font-size: 12px; color: #666; margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
            Category: ${word.category} | Added: ${new Date(word.dateAdded).toLocaleDateString()} | Status: ${word.difficulty}
          </div>
        </div>
      `.replace(/\n\s+/g, ' ').trim();
      
      // Tags include category and difficulty
      const tags = `SmartDefine ${word.category} ${word.difficulty}`;
      
      return `${front}\t${back}\t${tags}`;
    });
    
    return header + ankiCards.join('\n');
  }

  // Download file helper
  function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }


  // Word details modal
  function showWordDetailsModal(wordData) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 2000;
      display: flex;
      justify-content: center;
      align-items: center;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease-out;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      padding: 0;
      border-radius: 16px;
      max-width: 700px;
      max-height: 85vh;
      overflow: hidden;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.2);
      animation: slideUp 0.3s ease-out;
    `;

    const formattedExplanation = formatExplanationToHTML(wordData.explanation);
    const difficultyColor = getDifficultyColor(wordData.difficulty);
    
    // Create styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .modal-scrollable {
        max-height: 85vh;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e0 #f7fafc;
      }
      .modal-scrollable::-webkit-scrollbar {
        width: 6px;
      }
      .modal-scrollable::-webkit-scrollbar-track {
        background: #f7fafc;
      }
      .modal-scrollable::-webkit-scrollbar-thumb {
        background: #cbd5e0;
        border-radius: 3px;
      }
      .definition-section h3 {
        color: #2563eb;
        font-size: 16px;
        margin: 20px 0 8px 0;
        font-weight: 600;
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 4px;
      }
      .definition-section p {
        margin: 8px 0;
        line-height: 1.6;
      }
      .definition-section ul {
        margin: 8px 0;
        padding-left: 20px;
      }
      .definition-section li {
        margin: 4px 0;
        line-height: 1.5;
      }
      .pronunciation {
        font-style: italic;
        color: #6b7280;
        font-size: 14px;
      }
    `;
    content.appendChild(style);
    
    // Create header
    const header = document.createElement('div');
    header.style.cssText = 'background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 24px 30px; position: relative;';
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close-btn';
    closeBtn.style.cssText = `
      position: absolute;
      top: 16px;
      right: 20px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    `;
    closeBtn.textContent = '×';
    header.appendChild(closeBtn);
    
    // Title section
    const titleSection = document.createElement('div');
    titleSection.style.cssText = 'display: flex; align-items: center; gap: 16px; margin-bottom: 12px;';
    
    const title = document.createElement('h1');
    title.style.cssText = 'margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);';
    title.textContent = wordData.word;
    
    const difficultyBadge = document.createElement('span');
    difficultyBadge.style.cssText = `
      background: ${difficultyColor};
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    difficultyBadge.textContent = wordData.difficulty;
    
    titleSection.appendChild(title);
    titleSection.appendChild(difficultyBadge);
    header.appendChild(titleSection);
    
    // Audio pronunciation button
    if ('speechSynthesis' in window) {
      const pronunciationBtn = document.createElement('button');
      pronunciationBtn.className = 'pronunciation-btn';
      pronunciationBtn.style.cssText = `
        position: absolute;
        top: 16px;
        right: 60px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      `;
      pronunciationBtn.title = 'Play Pronunciation';
      pronunciationBtn.textContent = '🔊';
      header.appendChild(pronunciationBtn);
    }
    
    // Meta information
    const metaInfo = document.createElement('div');
    metaInfo.style.cssText = 'display: flex; gap: 24px; font-size: 14px; opacity: 0.9;';
    
    const categorySpan = document.createElement('span');
    categorySpan.style.cssText = 'display: flex; align-items: center; gap: 6px;';
    const categoryIcon = document.createElement('span');
    categoryIcon.style.fontSize = '16px';
    categoryIcon.textContent = '📂';
    categorySpan.appendChild(categoryIcon);
    categorySpan.appendChild(document.createTextNode(wordData.category));
    
    const dateSpan = document.createElement('span');
    dateSpan.style.cssText = 'display: flex; align-items: center; gap: 6px;';
    const dateIcon = document.createElement('span');
    dateIcon.style.fontSize = '16px';
    dateIcon.textContent = '📅';
    dateSpan.appendChild(dateIcon);
    dateSpan.appendChild(document.createTextNode(new Date(wordData.dateAdded).toLocaleDateString()));
    
    const reviewSpan = document.createElement('span');
    reviewSpan.style.cssText = 'display: flex; align-items: center; gap: 6px;';
    const reviewIcon = document.createElement('span');
    reviewIcon.style.fontSize = '16px';
    reviewIcon.textContent = '🔁';
    reviewSpan.appendChild(reviewIcon);
    reviewSpan.appendChild(document.createTextNode(`${wordData.reviewCount || 0} reviews`));

    const providerSpan = document.createElement('span');
    providerSpan.style.cssText = 'display: flex; align-items: center; gap: 6px;';
    const providerIcon = document.createElement('span');
    providerIcon.style.fontSize = '16px';
    providerIcon.textContent = '🔧';
    providerSpan.appendChild(providerIcon);
    providerSpan.appendChild(document.createTextNode(wordData.provider || 'Unknown'));

    metaInfo.appendChild(categorySpan);
    metaInfo.appendChild(dateSpan);
    metaInfo.appendChild(reviewSpan);
    metaInfo.appendChild(providerSpan);
    header.appendChild(metaInfo);
    
    content.appendChild(header);
    
    // Create scrollable content
    const scrollableContent = document.createElement('div');
    scrollableContent.className = 'modal-scrollable';
    
    const contentPadding = document.createElement('div');
    contentPadding.style.padding = '30px';
    
    // Definition section
    const definitionSection = document.createElement('div');
    definitionSection.className = 'definition-section';
    definitionSection.style.cssText = `
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
      line-height: 1.7;
      color: #1f2937;
    `;
    
    // Use the formatExplanationToHTML function which already returns safe HTML
    // Convert to DOM elements using a temporary container
    const parser = new DOMParser();
    const parsedExplanation = parser.parseFromString(formattedExplanation, 'text/html');
    parsedExplanation.body.childNodes.forEach(node => {
      definitionSection.appendChild(node.cloneNode(true));
    });
    
    contentPadding.appendChild(definitionSection);
    
    // Context section if available
    if (wordData.context && (wordData.context.fullSentence || (wordData.context.before && wordData.context.after))) {
      const contextSection = document.createElement('div');
      contextSection.style.cssText = `
        background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%);
        border: 1px solid #b3d9ff;
        border-radius: 12px;
        padding: 20px;
        margin-top: 24px;
      `;
      
      const contextHeader = document.createElement('div');
      contextHeader.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 12px;';
      
      const contextIcon = document.createElement('span');
      contextIcon.style.fontSize = '18px';
      contextIcon.textContent = '🎯';
      
      const contextTitle = document.createElement('h3');
      contextTitle.style.cssText = 'margin: 0; color: #1e40af; font-size: 16px; font-weight: 600;';
      contextTitle.textContent = 'Context Information';
      
      contextHeader.appendChild(contextIcon);
      contextHeader.appendChild(contextTitle);
      contextSection.appendChild(contextHeader);
      
      if (wordData.context.fullSentence) {
        const fullSentenceDiv = document.createElement('div');
        fullSentenceDiv.style.marginBottom = '12px';
        
        const strongLabel = document.createElement('strong');
        strongLabel.style.color = '#1e40af';
        strongLabel.textContent = 'Full sentence:';
        fullSentenceDiv.appendChild(strongLabel);
        fullSentenceDiv.appendChild(document.createElement('br'));
        
        const sentenceSpan = document.createElement('span');
        sentenceSpan.style.cssText = 'color: #374151; font-style: italic;';
        sentenceSpan.textContent = `"${wordData.context.fullSentence}"`;
        fullSentenceDiv.appendChild(sentenceSpan);
        
        contextSection.appendChild(fullSentenceDiv);
      }
      
      if (wordData.context.before && wordData.context.after) {
        const surroundingDiv = document.createElement('div');
        
        const surroundingLabel = document.createElement('strong');
        surroundingLabel.style.color = '#1e40af';
        surroundingLabel.textContent = 'Surrounding text:';
        surroundingDiv.appendChild(surroundingLabel);
        surroundingDiv.appendChild(document.createElement('br'));
        
        const beforeSpan = document.createElement('span');
        beforeSpan.style.color = '#6b7280';
        beforeSpan.textContent = `...${wordData.context.before}`;
        
        const wordSpan = document.createElement('span');
        wordSpan.style.cssText = 'background: #fef3c7; padding: 2px 4px; border-radius: 4px; font-weight: 600;';
        wordSpan.textContent = wordData.word;
        
        const afterSpan = document.createElement('span');
        afterSpan.style.color = '#6b7280';
        afterSpan.textContent = `${wordData.context.after}...`;
        
        surroundingDiv.appendChild(beforeSpan);
        surroundingDiv.appendChild(document.createTextNode(' '));
        surroundingDiv.appendChild(wordSpan);
        surroundingDiv.appendChild(document.createTextNode(' '));
        surroundingDiv.appendChild(afterSpan);
        
        contextSection.appendChild(surroundingDiv);
      }
      
      contentPadding.appendChild(contextSection);
    }
    
    // Notes section if available
    if (wordData.notes) {
      const notesSection = document.createElement('div');
      notesSection.style.cssText = `
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        border: 1px solid #f59e0b;
        border-radius: 12px;
        padding: 20px;
        margin-top: 24px;
      `;
      
      const notesHeader = document.createElement('div');
      notesHeader.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 12px;';
      
      const notesIcon = document.createElement('span');
      notesIcon.style.fontSize = '18px';
      notesIcon.textContent = '📝';
      
      const notesTitle = document.createElement('h3');
      notesTitle.style.cssText = 'margin: 0; color: #92400e; font-size: 16px; font-weight: 600;';
      notesTitle.textContent = 'Personal Notes';
      
      notesHeader.appendChild(notesIcon);
      notesHeader.appendChild(notesTitle);
      notesSection.appendChild(notesHeader);
      
      const notesContent = document.createElement('div');
      notesContent.style.cssText = 'color: #78350f; line-height: 1.6;';
      notesContent.textContent = wordData.notes;
      notesSection.appendChild(notesContent);
      
      contentPadding.appendChild(notesSection);
    }
    
    scrollableContent.appendChild(contentPadding);
    content.appendChild(scrollableContent);

    modal.className = 'modal';
    modal.appendChild(content);
    document.body.appendChild(modal);

    // Add event listeners for close functionality - closeBtn already exists from createElement above
    const modalCloseButton = modal.querySelector('.modal-close-btn');
    if (modalCloseButton) {
      modalCloseButton.onclick = () => modal.remove();
      modalCloseButton.onmouseover = () => {
        modalCloseButton.style.background = 'rgba(255, 255, 255, 0.3)';
        modalCloseButton.style.transform = 'scale(1.1)';
      };
      modalCloseButton.onmouseout = () => {
        modalCloseButton.style.background = 'rgba(255, 255, 255, 0.2)';
        modalCloseButton.style.transform = 'scale(1)';
      };
    }

    // Add event listeners for pronunciation button
    const pronunciationBtn = modal.querySelector('.pronunciation-btn');
    if (pronunciationBtn) {
      pronunciationBtn.onclick = () => playPronunciation(wordData.word, wordData.explanation);
      pronunciationBtn.onmouseover = () => {
        pronunciationBtn.style.background = 'rgba(255, 255, 255, 0.3)';
        pronunciationBtn.style.transform = 'scale(1.1)';
      };
      pronunciationBtn.onmouseout = () => {
        pronunciationBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        pronunciationBtn.style.transform = 'scale(1)';
      };
    }

    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };
  }

  // Format explanation from markdown to professional HTML
  function formatExplanationToHTML(explanation) {
    if (!explanation) return '<p>No explanation available</p>';
    
    let html = explanation
      // Convert headers with proper styling
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h3 style="color: #059669; border-left: 4px solid #10b981; padding-left: 12px; margin: 24px 0 12px 0;">$1</h3>')
      .replace(/^# (.+)$/gm, '<h3 style="color: #dc2626; font-size: 18px; margin: 24px 0 12px 0;">$1</h3>')
      
      // Convert bold and italic text
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color: #1f2937; font-weight: 600;">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em style="color: #4b5563;">$1</em>')
      
      // Convert bullet points with custom styling
      .replace(/^[-*+] (.+)$/gm, '<li style="margin: 6px 0; color: #374151;">$1</li>')
      
      // Convert numbered lists
      .replace(/^\d+\. (.+)$/gm, '<li style="margin: 6px 0; color: #374151;">$1</li>')
      
      // Handle line breaks and paragraphs
      .split('\n')
      .map(line => {
        line = line.trim();
        if (!line) return '';
        if (line.startsWith('<h3') || line.startsWith('<li') || line.startsWith('<strong') || line.startsWith('<em')) {
          return line;
        }
        // Regular paragraph text
        return `<p>${line}</p>`;
      })
      .join('\n')
      
      // Wrap consecutive list items in proper ul/ol tags
      .replace(/(<li[^>]*>.*?<\/li>\s*)+/gs, (match) => {
        return `<ul style="margin: 12px 0; padding-left: 24px; list-style-type: none;">
          ${match.replace(/<li/g, '<li style="position: relative; padding-left: 16px; margin: 8px 0;" data-bullet="•"')}
        </ul>`;
      })
      
      // Add custom bullet points
      .replace(/data-bullet="•"/g, `
        style="position: relative; padding-left: 16px; margin: 8px 0;"
        before-content="•"
      `)
      
      // Clean up empty paragraphs and extra whitespace
      .replace(/<p>\s*<\/p>/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    // Add CSS for custom bullets
    html = `
      <style>
        .definition-section li::before {
          content: "•";
          color: #059669;
          font-weight: bold;
          position: absolute;
          left: 0;
          top: 0;
        }
        .definition-section strong {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 50%);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #f59e0b;
        }
        .definition-section em {
          background: linear-gradient(135deg, #e0f2fe 0%, #b3e5fc 50%);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #0288d1;
        }
      </style>
    ` + html;

    return html;
  }

  // Get difficulty color for styling
  function getDifficultyColor(difficulty) {
    switch (difficulty) {
      case 'new':
        return '#1976d2';
      case 'learning':
        return '#f57c00';
      case 'mastered':
        return '#388e3c';
      default:
        return '#666';
    }
  }

  // Export individual word functions
  function exportWordToPDF(wordData) {
    const htmlContent = generateSingleWordPDFContent(wordData);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.addEventListener('load', () => {
        printWindow.print();
        setTimeout(() => printWindow.close(), 1000);
      });
    }
    
    showMessage(`"${wordData.word}" PDF export initiated!`, 'success');
  }

  function generateSingleWordPDFContent(wordData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${wordData.word} - SmartDefine</title>
        <style>
          @media print {
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
          }
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2196F3; padding-bottom: 15px; }
          .word-title { font-size: 36px; font-weight: bold; color: #2196F3; margin: 0; }
          .word-meta { font-size: 14px; color: #666; margin: 10px 0; }
          .explanation { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
          .notes { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="word-title">${wordData.word}</div>
          <div class="word-meta">
            Category: ${wordData.category} | 
            Added: ${new Date(wordData.dateAdded).toLocaleDateString()} | 
            Status: ${wordData.difficulty} | 
            Reviews: ${wordData.reviewCount || 0}
          </div>
        </div>
        
        <div class="explanation">
          <h3>Explanation:</h3>
          ${cleanMarkdownForHTML(wordData.explanation)}
        </div>
        
        ${wordData.notes ? `
          <div class="notes">
            <h3>Personal Notes:</h3>
            ${wordData.notes}
          </div>
        ` : ''}
        
        <div class="footer">
          Generated by SmartDefine Browser Extension on ${new Date().toLocaleDateString()}
        </div>
      </body>
      </html>
    `;
  }

  function exportWordToTXT(wordData) {
    const cleanedExplanation = cleanMarkdownText(wordData.explanation);
    const content = `${wordData.word}\n\n${cleanedExplanation}\n\n${wordData.notes ? `Notes: ${wordData.notes}\n\n` : ''}Added: ${new Date(wordData.dateAdded).toLocaleDateString()}`;
    downloadFile(content, `${wordData.word}.txt`, 'text/plain');
    showMessage(`"${wordData.word}" exported to TXT!`, 'success');
  }

  function exportWordAsFlashcard(wordData) {
    const flashcardContent = generateFlashcardContent(wordData);

    const dataUrl = 'data:text/html;charset=utf-8,' +
      encodeURIComponent(flashcardContent);
    const printWindow = window.open(dataUrl, '_blank');

    printWindow.onload = () => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 1000);
    };
    
    showMessage(`"${wordData.word}" flashcard export initiated!`, 'success');
  }

  function generateFlashcardContent(wordData) {
    const meaning = extractMeaning(wordData.explanation);
    const cleanedExplanation = cleanMarkdownText(wordData.explanation);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Flashcard: ${wordData.word}</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            .flashcard { page-break-after: always; }
          }
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
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
          }
          .front .word { font-size: 24px; font-weight: bold; color: #2196F3; margin-bottom: 10px; }
          .front .category { font-size: 12px; color: #666; }
          .back .meaning { font-size: 14px; font-weight: bold; margin-bottom: 8px; }
          .back .explanation { font-size: 11px; line-height: 1.3; }
          .back .notes { font-size: 10px; color: #666; margin-top: 8px; font-style: italic; }
          .label { position: absolute; top: 5px; left: 5px; font-size: 8px; color: #999; }
        </style>
      </head>
      <body>
        <!-- Front of flashcard -->
        <div class="flashcard front">
          <div class="label">FRONT</div>
          <div class="word">${wordData.word}</div>
          <div class="category">${wordData.category}</div>
        </div>
        
        <!-- Back of flashcard -->
        <div class="flashcard back">
          <div class="label">BACK</div>
          <div class="meaning">${cleanMarkdownText(meaning)}</div>
          <div class="explanation">${cleanedExplanation.substring(0, 200)}${cleanedExplanation.length > 200 ? '...' : ''}</div>
          ${wordData.notes ? `<div class="notes">Notes: ${wordData.notes.substring(0, 100)}${wordData.notes.length > 100 ? '...' : ''}</div>` : ''}
        </div>
        
        <div style="text-align: center; margin-top: 20px; font-size: 10px; color: #999;">
          Cut along the borders and fold to create double-sided flashcards
        </div>
      </body>
      </html>
    `;
  }

  // Helper function to clean markdown for HTML display
  function cleanMarkdownForHTML(text) {
    return text
      // Convert markdown headers to HTML headers
      .replace(/^#{3}\s*(.+)$/gm, '<h3>$1</h3>')
      .replace(/^#{2}\s*(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#{1}\s*(.+)$/gm, '<h1>$1</h1>')
      // Convert markdown bold to HTML bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Convert markdown italic to HTML italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Convert markdown list items to HTML list items
      .replace(/^[-*+]\s+(.+)$/gm, '• $1')
      // Convert line breaks to HTML breaks
      .replace(/\n/g, '<br>')
      // Clean up extra breaks
      .replace(/(<br\s*\/?>\s*){3,}/g, '<br><br>');
  }

  // Helper function to clean markdown for plain text
  function cleanMarkdownText(text) {
    return text
      // Remove markdown headers
      .replace(/#{1,6}\s*/g, '')
      // Remove markdown bold
      .replace(/\*\*(.*?)\*\*/g, '$1')
      // Remove markdown italic
      .replace(/\*(.*?)\*/g, '$1')
      // Convert markdown list items to bullet points
      .replace(/^[-*+]\s+/gm, '• ')
      // Clean up extra whitespace
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  // Audio pronunciation function using Merriam-Webster API and fallback to Web Speech API
  async function playPronunciation(word, response) {
    try {
      // First try Merriam-Webster audio
      const audioPlayed = await tryMerriamWebsterAudio(word);
      if (audioPlayed) {
        return;
      }
      
      // Fallback to Web Speech API
      playWebSpeechPronunciation(word, response);
      
    } catch (error) {
      console.warn('Error playing pronunciation:', error);
      // Final fallback to Web Speech API
      playWebSpeechPronunciation(word, response);
    }
  }

  // Try to play audio from Merriam-Webster Dictionary
  async function tryMerriamWebsterAudio(word) {
    try {
      const cleanWord = word.toLowerCase().trim();
      console.log('Trying Merriam-Webster audio for:', cleanWord);
      
      // Try common audio URL patterns for Merriam-Webster
      const audioUrls = [
        `https://media.merriam-webster.com/audio/prons/en/us/mp3/${cleanWord.charAt(0)}/${cleanWord}.mp3`,
        `https://media.merriam-webster.com/audio/prons/en/us/wav/${cleanWord.charAt(0)}/${cleanWord}.wav`
      ];
      
      for (const audioUrl of audioUrls) {
        try {
          console.log('Trying audio URL:', audioUrl);
          const audio = new Audio(audioUrl);
          
          // Set up promise to handle audio loading
          const audioPromise = new Promise((resolve, reject) => {
            audio.oncanplaythrough = () => {
              console.log('Audio loaded successfully from Merriam-Webster');
              resolve(true);
            };
            audio.onerror = () => {
              console.log('Audio failed to load from:', audioUrl);
              reject(false);
            };
            // Timeout after 3 seconds
            setTimeout(() => reject(false), 3000);
          });
          
          // Try to load and play
          audio.load();
          await audioPromise;
          
          // If we get here, audio loaded successfully
          audio.volume = 0.8;
          await audio.play();
          console.log('Successfully played Merriam-Webster audio for:', word);
          return true;
          
        } catch (urlError) {
          console.log('Failed to load audio from:', audioUrl);
          continue;
        }
      }
      
      return false;
    } catch (error) {
      console.warn('Merriam-Webster audio failed:', error);
      return false;
    }
  }

  // Fallback Web Speech API pronunciation
  function playWebSpeechPronunciation(word, response) {
    try {
      // Check if Speech Synthesis is available
      if (!('speechSynthesis' in window)) {
        console.warn('Speech Synthesis not supported');
        return;
      }

      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      
      // Extract phonetic pronunciation if available
      const phoneticText = extractPhoneticText(response);
      console.log('Extracted phonetic text:', phoneticText);
      
      // Use the original word if phonetic extraction failed or returned unwanted text
      let textToSpeak = word; // Default to original word
      
      if (phoneticText && phoneticText.length > 0) {
        // Only use phonetic if it seems valid (not containing grammar terms)
        const lowerPhonetic = phoneticText.toLowerCase();
        if (!lowerPhonetic.includes('adjective') && 
            !lowerPhonetic.includes('noun') &&
            !lowerPhonetic.includes('verb') &&
            !lowerPhonetic.includes('adverb') &&
            !lowerPhonetic.includes('asterics') &&
            !lowerPhonetic.includes('asterisk') &&
            phoneticText.length <= word.length + 10) { // Reasonable length
          textToSpeak = phoneticText;
        }
      }
      
      console.log('Web Speech API - Text to speak:', textToSpeak);
      
      // Create speech utterance
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      // Configure speech settings for better pronunciation
      utterance.rate = 0.6; // Slower rate for better clarity
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      utterance.lang = 'en-US';
      
      // Optional: Try to use a specific voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith('en') && 
        (voice.name.includes('Google') || voice.name.includes('Microsoft') || voice.name.includes('Daniel') || voice.name.includes('Samantha'))
      );
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        console.log('Using voice:', preferredVoice.name);
      }
      
      // Add event listeners for feedback
      utterance.onstart = () => {
        console.log('Web Speech pronunciation started for:', textToSpeak);
      };
      
      utterance.onerror = (event) => {
        console.warn('Speech synthesis error:', event.error);
      };
      
      utterance.onend = () => {
        console.log('Web Speech pronunciation ended');
      };
      
      // Speak the word
      window.speechSynthesis.speak(utterance);
      
    } catch (error) {
      console.warn('Error with Web Speech API:', error);
    }
  }

  // Extract phonetic text from the response for better pronunciation
  function extractPhoneticText(response) {
    try {
      const lines = response.split('\n');
      
      // Look for respelling/phonetic section
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim().toLowerCase();
        if (line.includes('respelling') || line.includes('phonetic') || line.includes('pronunciation')) {
          // Check the next few lines for phonetic content
          for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
            let phoneticLine = lines[j].trim();
            
            // Skip empty lines or lines that are clearly headers
            if (!phoneticLine || phoneticLine.length === 0 || 
                phoneticLine.toLowerCase().includes('synonym') ||
                phoneticLine.toLowerCase().includes('antonym') ||
                phoneticLine.toLowerCase().includes('example') ||
                phoneticLine.startsWith('**') ||
                phoneticLine.startsWith('#')) {
              continue;
            }
            
            // Remove markdown formatting
            phoneticLine = phoneticLine.replace(/\*\*/g, '').replace(/\*/g, '');
            
            // Look for content in parentheses (common for phonetics)
            const phoneticMatch = phoneticLine.match(/\(([^)]+)\)/);
            if (phoneticMatch) {
              const extracted = phoneticMatch[1];
              // Validate it's actually phonetic (not "adjective" or other descriptions)
              if (!extracted.toLowerCase().includes('adjective') && 
                  !extracted.toLowerCase().includes('noun') &&
                  !extracted.toLowerCase().includes('verb') &&
                  !extracted.toLowerCase().includes('adverb') &&
                  extracted.length > 0) {
                return extracted;
              }
            }
            
            // If no parentheses, check if line contains valid phonetic content
            if (phoneticLine.length > 0 && phoneticLine.length < 50) {
              return phoneticLine;
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Error extracting phonetic text:', error);
      return null;
    }
  }

});