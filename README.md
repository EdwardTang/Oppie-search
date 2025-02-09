# Oppie.xyz 🌟
### Open Paths to Discovery

Welcome to Oppie, an innovative AI-powered research platform that brings advanced language models directly to your browser. Named after J. Robert Oppenheimer, whose legacy of scientific innovation and ethical reflection inspires our commitment to open inquiry and responsible advancement, Oppie democratizes access to AI technology while maintaining high standards of performance and ethical responsibility.

## 🎯 Vision

Oppie.xyz implements a Perplexity-like experience running entirely in your browser using WebGPU, making powerful AI accessible to everyone. By leveraging local computation, we ensure privacy and promote unrestricted learning while maintaining high performance.

## 🚀 Core Features

- 🧠 **Local LLM Inference**: Harness the power of AI directly in your browser using WebGPU
- 🔍 **Intelligent Web Search**: Seamless integration with web search capabilities
- 💬 **Interactive Experience**: Real-time chat interface with streaming responses
- 📝 **Rich Content Support**: Full markdown rendering for enhanced readability
- 🎨 **Modern Interface**: Clean, intuitive UI designed for optimal user experience
- ⚡ **High Performance**: Real-time streaming responses for immediate feedback

## 💻 Technical Foundation

Our commitment to excellence is reflected in our carefully chosen technical stack:

- **Frontend**: Pure Vanilla JavaScript, HTML, and CSS for maximum efficiency
- **Language Model**: SmolLM2-1.7B-Instruct (via Hugging Face Transformers.js)
- **Key Dependencies**:
  - @huggingface/transformers (model inference)
  - markdown-it (content rendering)

## 🔧 System Requirements

To ensure optimal performance and accessibility:
- Modern web browser with WebGPU support (Chrome or Brave recommended)
- Sufficient GPU memory for model operations

## 🌟 Getting Started

Begin your journey with Oppie in just a few steps:

1. Launch a local web server in your project directory using any of these methods:
   ```bash
   # Using Python 3
   python -m http.server 8000

   # Using Node.js's http-server (install first with: npm install -g http-server)
   http-server

   # Using PHP
   php -S localhost:8000
   ```

2. Access the platform through your browser:
   - Python server: `http://localhost:8000`
   - http-server: `http://localhost:8080`
   - PHP server: `http://localhost:8000`

3. Initialize the AI by clicking "Load Model"
4. Begin your exploration through the chat interface
5. Enhance your research with web search using the `<search>` command

> 📝 Note: Direct HTML file opening is not supported due to CORS restrictions and ES module requirements.

## 🤖 Model Insights

In our commitment to transparency and optimal performance:

- ONNX models can present loading challenges
- Quantized models may have limitations with system messages
- Our recommended model: `HuggingFaceTB/SmolLM2-1.7B-Instruct` - offers superior system message handling
- While phi-3.5 shows promise, current implementation faces challenges

## 📁 Project Architecture

Our clean, modular structure ensures maintainability and scalability:

- `index.html` - Primary entry point and UI framework
- `chatbot.js` - Core AI interaction and model integration
- `utils.js` - Essential helper functions and utilities
- `styles.css` - Modern, responsive UI styling

## 🌐 Browser Support

Current recommended browsers for optimal WebGPU performance:
- Google Chrome (latest version)
- Brave Browser (latest version)

## 🤝 Join Our Mission

Oppie represents our commitment to democratizing AI technology while maintaining high ethical standards and performance. We invite you to explore, learn, and contribute to this journey of discovery.

---

*"The open mind and the receptive heart - ingredients of both scientific and spiritual inquiry." - Inspired by J. Robert Oppenheimer* 