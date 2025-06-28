// src/ui/popup_new.js

document.addEventListener('DOMContentLoaded', () => {
  // Initialize navigation buttons
  initializeNavigation();
  
  console.log('SmartDefine Popup initialized');
});

function initializeNavigation() {
  // Word List button
  const openWordListBtn = document.getElementById('openWordList');
  if (openWordListBtn) {
    openWordListBtn.addEventListener('click', () => {
      openExtensionPage('wordlist');
    });
  }

  // Practice button
  const openPracticeBtn = document.getElementById('openPractice');
  if (openPracticeBtn) {
    openPracticeBtn.addEventListener('click', () => {
      openExtensionPage('practice');
    });
  }

  // Settings button
  const openSettingsBtn = document.getElementById('openSettings');
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      openExtensionPage('settings');
    });
  }
}

function openExtensionPage(tab = 'wordlist') {
  try {
    // Create the URL with tab parameter
    const extensionUrl = browser.runtime.getURL(`src/ui/extension_tabs.html?tab=${tab}`);
    
    // Open the extension page in a new tab
    browser.tabs.create({
      url: extensionUrl
    }).then(() => {
      // Close the popup
      window.close();
    }).catch((error) => {
      console.error('Error opening extension page:', error);
      // Fallback: try to open without the tab parameter
      browser.tabs.create({
        url: browser.runtime.getURL('src/ui/extension_tabs.html')
      }).then(() => {
        window.close();
      });
    });
  } catch (error) {
    console.error('Error in openExtensionPage:', error);
    
    // Ultimate fallback: try to open the old wordlist page
    try {
      browser.tabs.create({
        url: browser.runtime.getURL('src/ui/wordlist.html')
      }).then(() => {
        window.close();
      });
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
  }
}

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  switch(e.key) {
    case '1':
      openExtensionPage('wordlist');
      break;
    case '2':
      openExtensionPage('practice');
      break;
    case '3':
      openExtensionPage('settings');
      break;
    case 'Escape':
      window.close();
      break;
  }
});

// Add visual feedback for button interactions
document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.nav-button');
  
  buttons.forEach(button => {
    // Add ripple effect on click
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
      `;
      
      // Add ripple animation style if it doesn't exist
      if (!document.getElementById('ripple-style')) {
        const style = document.createElement('style');
        style.id = 'ripple-style';
        style.textContent = `
          @keyframes ripple {
            to {
              transform: scale(2);
              opacity: 0;
            }
          }
          .nav-button {
            position: relative;
            overflow: hidden;
          }
        `;
        document.head.appendChild(style);
      }
      
      this.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });
});