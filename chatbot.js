import { pipeline, env, AutoTokenizer, AutoModelForCausalLM, TextStreamer } from '@huggingface/transformers';
import { processResponseForContext } from './utils.js';
import markdownit from 'markdown-it';

// Skip local model check since we're downloading from HF Hub
env.allowLocalModels = false;

const SYSTEM_PROMPT = `You are a helpful AI assistant that can search the web. When you need information to answer a question, use the search command like this:

<search>your search query</search>

For example:
User: What's the weather in Dublin?
Assistant: Let me check that for you.
<search>Dublin Ireland current weather</search>

Keep your responses concise and focused on the information needed.`;

// Flag to control how system message is handled
const PREPEND_SYSTEM_TO_USER = true;

const md = new markdownit();

class TextGenerationPipeline {
    // static model_id = "HuggingFaceTB/SmolLM2-1.7B-Instruct";
    // static model_id = "HuggingFaceTB/SmolLM2-1.7B-Instruct";


    // static model_id = "onnx-community/Qwen2.5-Coder-1.5B-Instruct"; # won't respect system message.

    // static model_id = "onnx-community/Phi-3.5-mini-instruct-onnx-web"; # this won't work.
    // static model_id = "onnx-community/Qwen2.5-1.5B-Instruct"; # fails to load
    // static model_id = "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX";
    // static model_id = "onnx-community/Llama-3.2-1B-Instruct-onnx-web-gqa";
    // static model_id = "onnx-community/Llama-3.2-3B-Instruct-onnx-web-gqa";
    // static model_id = "onnx-community/Llama-3.2-1B-Instruct"; # poor probably due to quanting.
    
    static model_id = "Xenova/Phi-3-mini-4k-instruct_fp16";
    static tokenizer = null;
    static model = null;
    static adapter = null;
    static device = null;

    static async cleanup() {
        if (this.model) {
            try {
                // Destroy model resources
                await this.model.destroy();
                this.model = null;
            } catch (e) {
                console.error('Error cleaning up model:', e);
            }
        }
        if (this.device) {
            try {
                // Destroy WebGPU device
                this.device.destroy();
                this.device = null;
            } catch (e) {
                console.error('Error cleaning up device:', e);
            }
        }
        this.tokenizer = null;
        this.adapter = null;
    }

    static async getInstance(progress_callback = null) {
        if (!this.tokenizer || !this.model) {
            console.log('Creating new pipeline instance...');
            
            // Cleanup any existing resources first
            await this.cleanup();
            
            // Initialize WebGPU
            this.adapter = await navigator.gpu?.requestAdapter();
            if (!this.adapter) {
                throw new Error('WebGPU adapter not available');
            }
            this.device = await this.adapter.requestDevice();
            
            // Load tokenizer and model separately for better control
            console.log('About to load tokenizer...');
            this.tokenizer = await AutoTokenizer.from_pretrained(this.model_id, {
                progress_callback,
            });
            console.log('Tokenizer loaded, inspecting properties:', {
                hasTemplate: !!this.tokenizer.chat_template,
                template: this.tokenizer.chat_template,
                config: this.tokenizer.config,
            });

            // Set correct chat template for Phi-3-mini models
            if (this.model_id.toLowerCase().includes('phi-3-mini')) {
                console.log('Setting Phi-3-mini specific chat template');
                this.tokenizer.chat_template = `{% for message in messages %}{% if message['role'] == 'system' %}{{'<|system|>\\n' + message['content'] + '<|end|>\\n'}}{% elif message['role'] == 'user' %}{{'<|user|>\\n' + message['content'] + '<|end|>\\n'}}{% elif message['role'] == 'assistant' %}{{'<|assistant|>\\n' + message['content'] + '<|end|>\\n'}}{% endif %}{% endfor %}{% if add_generation_prompt %}{{ '<|assistant|>\\n' }}{% else %}{{ eos_token }}{% endif %}`;
            }

            this.model = await AutoModelForCausalLM.from_pretrained(this.model_id, {
                dtype: "q4f16", 
                // dtype: "q4",                // use for phi-3-mini
                // use_external_data_format: true, // use for phi-3-mini
                device: "webgpu",
                progress_callback,
            });
            
            console.log('Pipeline created successfully');
        }
        return [this.tokenizer, this.model];
    }
}

class ChatBot {
    constructor() {
        console.log('Initializing ChatBot...');
        // Get DOM elements
        this.chatContainer = document.getElementById('chat-container');
        this.userInput = document.getElementById('user-input');
        this.sendButton = document.getElementById('send-button');
        this.stopButton = document.getElementById('stop-button');
        this.statusDiv = document.getElementById('status');
        this.loadButton = document.getElementById('load-button');
        this.progressContainer = document.getElementById('progress-container');
        this.progressFill = document.getElementById('progress-fill');
        this.contextContainer = document.getElementById('context-container');
        
        // Initialize state
        this.messages = PREPEND_SYSTEM_TO_USER ? [] : [{
            role: 'system',
            content: SYSTEM_PROMPT
        }];
        this.isGenerating = false;
        this.isModelLoaded = false;
        
        // Ensure input and buttons start disabled
        this.userInput.disabled = true;
        this.sendButton.disabled = true;
        this.stopButton.disabled = true;
        this.loadButton.disabled = false;
        
        // Clear any existing status
        this.updateStatus('Click "Load Model" to begin');
        
        this.setupEventListeners();
        console.log('ChatBot initialized');
        
        // Add cleanup on page unload
        window.addEventListener('unload', async () => {
            await TextGenerationPipeline.cleanup();
        });
    }

    setupEventListeners() {
        this.loadButton.addEventListener('click', () => this.initialize());
        this.sendButton.addEventListener('click', () => this.handleSend());
        this.stopButton.addEventListener('click', () => this.handleStop());
        document.getElementById('clear-button').addEventListener('click', () => this.handleClear());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSend();
        });
    }

    updateProgress(progress) {
        console.log('Progress update:', progress);
        if (progress.status === 'progress' && progress.loaded && progress.total) {
            const percent = Math.min(Math.round((progress.loaded / progress.total) * 100), 100);
            this.progressFill.style.width = `${percent}%`;
            const loadedMB = Math.round(progress.loaded / 1024 / 1024);
            const totalMB = Math.round(progress.total / 1024 / 1024);
            this.updateStatus(`Loading model: ${percent}% (${loadedMB}MB / ${totalMB}MB)`);
        } else if (progress.status === 'progress' && progress.progress) {
            // Fallback to progress field if loaded/total not available
            const percent = Math.min(Math.round(progress.progress * 100), 100);
            this.progressFill.style.width = `${percent}%`;
            this.updateStatus(`Loading model: ${percent}%`);
        }
    }

    async initialize() {
        console.log('Starting initialization...');
        this.loadButton.disabled = true;
        this.progressContainer.style.display = 'block';
        this.progressFill.style.width = '0%';
        
        try {
            console.log('Checking WebGPU support...');
            const adapter = await navigator.gpu?.requestAdapter();
            if (!adapter) {
                document.getElementById('browser-warning').style.display = 'block';
                throw new Error('WebGPU is not supported. Please use Chrome or Brave browser.');
            }
            console.log('WebGPU supported, adapter found');
            
            this.updateStatus('Loading model...');
            console.log('Starting model load...');
            await TextGenerationPipeline.getInstance((progress) => {
                console.log('Load progress:', progress);
                this.updateProgress(progress);
            });
            
            console.log('Model loaded successfully');
            this.isModelLoaded = true;
            this.updateStatus('Model ready!');
            
            // Enable input and send button
            console.log('Enabling input and send button');
            this.userInput.disabled = false;
            this.sendButton.disabled = false;
            this.progressContainer.style.display = 'none';
            
            // Force a re-render of the input state
            this.userInput.style.opacity = '1';
            this.userInput.style.backgroundColor = 'white';
            
            console.log('Initialization complete');
        } catch (error) {
            console.error('Initialization error:', error);
            this.updateStatus(`Error: ${error.message}`);
            this.loadButton.disabled = false;
            this.progressContainer.style.display = 'none';
        }
    }

    updateStatus(message, isLoading = false) {
        console.log('Status update:', message);
        const statusDiv = this.statusDiv;
        statusDiv.textContent = message;
        if (isLoading) {
            statusDiv.classList.add('loading');
        } else {
            statusDiv.classList.remove('loading');
        }
    }

    addMessage(text, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        
        if (isUser) {
            messageDiv.textContent = text;
        } else {
            // For bot messages, render as markdown
            messageDiv.innerHTML = md.render(text);
            // Add loading dots if it's an empty message (initial bot response)
            if (!text) {
                messageDiv.innerHTML = '<span class="loading-dots">Thinking</span>';
            }
        }
        
        this.chatContainer.appendChild(messageDiv);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        return messageDiv;
    }

    updateContext(context) {
        // Clear previous context
        this.contextContainer.innerHTML = '';
        
        if (!context.trim()) {
            this.contextContainer.innerHTML = '<p>No additional context available.</p>';
            return;
        }

        // Split context into individual results
        const results = context.split('\n\n');
        
        results.forEach(result => {
            if (result.trim()) {
                const contextItem = document.createElement('div');
                contextItem.className = 'context-item';
                
                // Parse the result (format: "N. Title\nSnippet\nURL")
                const [titleLine, snippet, url] = result.split('\n');
                const [number, ...titleParts] = titleLine.split('. ');
                const title = titleParts.join('. ');
                
                contextItem.innerHTML = `
                    <h3>${number}. ${title}</h3>
                    <p>${snippet}</p>
                    <a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>
                `;
                
                this.contextContainer.appendChild(contextItem);
            }
        });
    }

    async handleSend() {
        const userMessage = this.userInput.value.trim();
        if (!userMessage || this.isGenerating || !this.isModelLoaded) return;

        console.log('=== Starting new message handling ===');
        this.userInput.value = '';
        this.addMessage(userMessage, true);
        
        // If PREPEND_SYSTEM_TO_USER is true and this is the first message, prepend system prompt
        if (PREPEND_SYSTEM_TO_USER && this.messages.length === 0) {
            this.messages = [{
                role: 'user',
                content: `${SYSTEM_PROMPT}\n\n${userMessage}`
            }];
        } else {
            this.messages.push({ role: 'user', content: userMessage });
        }
        console.log('Current messages:', JSON.stringify(this.messages, null, 2));

        this.isGenerating = true;
        this.sendButton.disabled = true;
        this.stopButton.disabled = false;
        this.userInput.disabled = true;

        try {
            console.log('Getting model and tokenizer...');
            const [tokenizer, model] = await TextGenerationPipeline.getInstance();
            
            const botMessageDiv = this.addMessage('', false);
            let currentResponse = '';

            console.log('Preparing chat template...');
            console.log('Current tokenizer chat template:', tokenizer.chat_template);
            console.log('Messages being formatted:', this.messages);
            
            // Get readable format first
            const readableTemplate = tokenizer.apply_chat_template(this.messages, {
                add_generation_prompt: true,
                return_dict: true,
                tokenize: false
            });
            console.log('Chat template output (readable):', readableTemplate);
            
            // Get tokenized version for model input
            const inputs = tokenizer.apply_chat_template(this.messages, {
                add_generation_prompt: true,
                return_dict: true,
            });
            console.log('Tokenizer inputs prepared');

            const streamer = new TextStreamer(tokenizer, {
                skip_prompt: true,
                skip_special_tokens: true,
                callback_function: async (token) => {
                    currentResponse += token;
                    botMessageDiv.innerHTML = md.render(currentResponse);
                    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
                }
            });

            console.log('Generating initial response...');
            await model.generate({
                ...inputs,
                max_new_tokens: 1024,
                do_sample: true,
                temperature: 0.7,
                top_k: 50,
                top_p: 0.95,
                streamer,
            });
            console.log('Initial response generated:', currentResponse);

            // Append the initial response to messages before processing context
            this.messages.push({ role: 'assistant', content: currentResponse });

            // Process response for search/visit tags
            console.log('Processing response for search/visit tags...');
            const context = await processResponseForContext(currentResponse);
            console.log('Got search/visit context:', context);
            this.updateContext(context);

            // If we got context, generate a follow-up response
            if (context.trim()) {
                console.log('Context found, generating follow-up response...');
                // Add a new thinking message while generating follow-up
                const followUpThinkingDiv = this.addMessage('', false);
                const followUpResponse = await this.generateFollowUp(context, currentResponse);
                currentResponse = followUpResponse;
                botMessageDiv.innerHTML = md.render(followUpResponse);
                // Remove the thinking message once we have the response
                followUpThinkingDiv.remove();
                console.log('Follow-up response generated:', followUpResponse);
                // Update the last assistant message with the follow-up response
                this.messages[this.messages.length - 1].content = followUpResponse;
            } else {
                console.log('No context found, skipping follow-up');
            }

            // Clean up the response if needed
            currentResponse = currentResponse.trim();
            botMessageDiv.innerHTML = md.render(currentResponse);
            console.log('Final messages:', JSON.stringify(this.messages, null, 2));
            
        } catch (error) {
            this.updateStatus(`Error: ${error.message}`);
            console.error('Generation error:', error);
        } finally {
            this.isGenerating = false;
            this.sendButton.disabled = false;
            this.stopButton.disabled = true;
            this.userInput.disabled = false;
            console.log('=== Message handling complete ===');
        }
    }

    async generateFollowUp(context, initialResponse) {
        const [tokenizer, model] = await TextGenerationPipeline.getInstance();
        
        // Append context message to existing conversation
        this.messages.push({ 
            role: 'user', 
            content: `Here are the search and webpage results:\n\n${context}\n\nPlease provide a brief response based on this information.` 
        });

        const inputs = tokenizer.apply_chat_template(this.messages, {
            add_generation_prompt: true,
            return_dict: true,
        });

        let followUpResponse = '';
        const streamer = new TextStreamer(tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: (token) => {
                followUpResponse += token;
            }
        });

        await model.generate({
            ...inputs,
            max_new_tokens: 1024,
            do_sample: true,
            temperature: 0.7,
            top_k: 50,
            top_p: 0.95,
            streamer,
        });

        return followUpResponse.trim();
    }

    async handleStop() {
        if (this.isGenerating) {
            this.isGenerating = false;
            this.stopButton.disabled = true;
            this.sendButton.disabled = false;
            this.userInput.disabled = false;
            // Don't cleanup resources here as we might want to continue using the model
        }
    }

    async handleClear() {
        // Just clear the chat interface and messages, keep the model loaded
        this.chatContainer.innerHTML = '';
        this.contextContainer.innerHTML = '';
        this.messages = PREPEND_SYSTEM_TO_USER ? [] : [{
            role: 'system',
            content: SYSTEM_PROMPT
        }];
        this.isGenerating = false;
        this.userInput.disabled = false;  // Keep enabled since model is still loaded
        this.sendButton.disabled = false; // Keep enabled since model is still loaded
        this.stopButton.disabled = true;
        this.loadButton.disabled = true;  // Keep disabled since model is still loaded
        this.updateStatus('Chat cleared. Model still loaded and ready.');
    }
}

// Initialize the chatbot when the page loads
window.addEventListener('load', () => {
    new ChatBot();
}); 