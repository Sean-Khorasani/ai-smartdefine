# SmartDefine Firefox Extension

## Build Manual and Documentation

### Table of Contents

1. [Overview](#overview)
2. [Usage Instructions](#usage-instructions)
3. [Development](#development)
4. [Contributing](#contributing)

---

## Overview

SmartDefine is a Firefox, Chrome, and Edge browser extension that provides instant AI-powered definitions and explanations for selected words on any webpage. Users can right-click on any selected text to get detailed explanations including meanings, synonyms, phonetic breakdowns, examples, collocations, and memory aids.

### Key Features

- **Right-click Context Menu**: Seamlessly integrated into Firefox's context menu
- **Multiple LLM Support**: Compatible with Google Gemini 2.0/2.5 and OpenAI GPT-4o
- **Customizable Prompts**: Users can modify the explanation format to their preferences
- **Beautiful UI**: Modern, responsive popup interface for settings configuration
- **Free Tier Support**: Optimized for free API tiers with proper error handling
- **Secure Storage**: API keys are stored locally and securely

### Architecture

The extension follows Firefox's WebExtension architecture with three main components:

1. **Background Script** (`src/background/background.js`): Handles context menu creation, API calls, and message routing
2. **Content Script** (`src/content/content.js`): Manages DOM interaction and modal display
3. **Popup Interface** (`src/ui/popup.html` + `popup.js`): Provides settings configuration UI

---

## Usage Instructions

### Basic Usage

1. **Navigate to any webpage** in Firefox
2. **Select any word or phrase** by highlighting it with your mouse
3. **Right-click** on the selected text
4. **Click "SmartDefine: [selected text]"** from the context menu
5. **View the explanation** in the modal dialog that appears

### Modal Controls

- **Close button (×)**: Click to close the explanation modal
- **Click outside**: Click anywhere outside the modal to close it
- **Escape key**: Press Escape to close the modal

### Customizing Explanations

You can customize what information the AI provides by modifying the prompt in settings:

**Example prompts**:
- Simple definition: "Define 'X_WORD_X' in simple terms"
- Academic style: "Provide a comprehensive analysis of 'X_WORD_X' including etymology, usage, and examples"
- Language learning: "Explain 'X_WORD_X' for English language learners with pronunciation and common mistakes"

---

## Development

### Project Structure

```
smartdefine-extension/
└── smartdefine-firefox-extension/      # Firefox extension (renamed) 
    ├── manifest.json                   # Updated, compliance-ready
    ├── src/background/background.js    # LLM integration + learning engine
    ├── src/content/content.js          # Modal UI + safe DOM methods
    ├── src/ui/                         # Advanced UI components
    │   ├── extension_tabs.js           # Fixed all innerHTML issues
    │   ├── wordlist.js                 # Fixed closeBtn duplicate declaration  
    │   ├── practice.js                 # Fixed with DOMParser
    │   └── *.html files                # Updated branding
    ├── icons/icon-48.png, icon-96.png  # Correct dimensions for Mozilla
    └── README.md                       # This documentation
```

### Code Style Guidelines

- Use modern JavaScript (ES6+)
- Follow consistent indentation (2 spaces)
- Add comments for complex logic
- Use meaningful variable names
- Handle errors gracefully

### Error Handling

The extension implements comprehensive error handling:

- **Network errors**: Displays user-friendly error messages
- **API rate limits**: Provides guidance on rate limit issues
- **Invalid API keys**: Clear instructions for key configuration
- **Malformed responses**: Graceful fallback for unexpected API responses

---

## Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Test thoroughly**:
   - Load extension in Firefox, Chrome, or Edge
   - Test all supported LLM models
   - Verify UI responsiveness
   - Check error handling
5. **Submit a pull request**

### Code Contributions

We welcome contributions in the following areas:

- **New LLM providers**: Add support for additional AI services
- **UI improvements**: Enhance the settings interface
- **Performance optimizations**: Improve response times and efficiency
- **Bug fixes**: Address any issues or edge cases
- **Documentation**: Improve this manual or add code comments

### Reporting Issues

When reporting bugs, please include:

- Firefox version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Console error messages (if any)
- Screenshots (if applicable)

### Feature Requests

For new features, please provide:

- Clear description of the proposed feature
- Use case and benefits
- Implementation suggestions (if any)
- Mockups or examples (if applicable)

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.

---

## Support

For support and questions:

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Refer to this manual for detailed instructions
- **Community**: Join discussions in the project repository

---

*Built with ❤️*

