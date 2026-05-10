"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMService = void 0;
const axios_1 = __importDefault(require("axios"));
const readability_1 = require("@mozilla/readability");
const jsdom_1 = require("jsdom");
class LLMService {
    provider;
    apiKey;
    ollamaUrl;
    geminiKey;
    constructor() {
        this.provider = process.env.LLM_PROVIDER || 'gemini';
        this.apiKey = this.provider === 'nvidia'
            ? process.env.NVIDIA_API_KEY
            : (process.env.HF_API_KEY || '');
        this.ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        this.geminiKey = process.env.GEMINI_API_KEY || '';
    }
    cleanContent(html) {
        const dom = new jsdom_1.JSDOM(html);
        const reader = new readability_1.Readability(dom.window.document);
        const article = reader.parse();
        return article ? article.textContent : '';
    }
    async summarize(html) {
        const text = this.cleanContent(html).substring(0, 4000);
        const prompt = `Summarize the following web page content in 5 bullet points:\n\n${text}`;
        return await this.callLLM(prompt);
    }
    async compare(pages) {
        const contents = pages.map(p => `URL: ${p.url}\nContent: ${p.summary}`).join('\n---\n');
        const prompt = `Compare the following pages and provide a structured comparison table in markdown:\n\n${contents}`;
        return await this.callLLM(prompt);
    }
    async callLLM(prompt, systemPrompt, retryCount = 0) {
        try {
            let rawResponse = '';
            if (this.provider === 'ollama') {
                rawResponse = await this.callOllama(prompt, systemPrompt);
            }
            else if (this.provider === 'nvidia') {
                rawResponse = await this.callNvidia(prompt, systemPrompt);
            }
            else if (this.provider === 'gemini') {
                rawResponse = await this.callGemini(prompt, systemPrompt);
            }
            else {
                rawResponse = await this.callHuggingFace(prompt);
            }
            return this.cleanAIResponse(rawResponse);
        }
        catch (error) {
            const isNetworkError = !error.response && error.code;
            const isRetryableStatus = error.response?.status === 429 || error.response?.status >= 500;
            if ((isNetworkError || isRetryableStatus) && retryCount < 3) {
                const delay = Math.pow(2, retryCount) * 1000;
                console.warn(`LLM Error (${error.code || error.response?.status}). Retrying in ${delay}ms... (Attempt ${retryCount + 1}/3)`);
                await new Promise(r => setTimeout(r, delay));
                return this.callLLM(prompt, systemPrompt, retryCount + 1);
            }
            throw error;
        }
    }
    cleanAIResponse(raw) {
        let cleaned = raw.trim();
        if (cleaned.startsWith('```')) {
            const lines = cleaned.split('\n');
            if (lines[0].startsWith('```'))
                lines.shift();
            if (lines[lines.length - 1].startsWith('```'))
                lines.pop();
            cleaned = lines.join('\n').trim();
        }
        cleaned = cleaned.replace(/^(JSON|Output|Response):\s*/i, '');
        return cleaned;
    }
    async callGemini(prompt, systemPrompt) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`;
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
        const response = await axios_1.default.post(url, {
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 4096,
            }
        }, { timeout: 60000 });
        if (response.data && response.data.candidates && response.data.candidates[0].content) {
            return response.data.candidates[0].content.parts[0].text;
        }
        return '';
    }
    async callNvidia(prompt, systemPrompt) {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: "system", content: systemPrompt });
        }
        messages.push({ role: "user", content: prompt });
        const response = await axios_1.default.post('https://integrate.api.nvidia.com/v1/chat/completions', {
            model: "meta/llama-3.1-70b-instruct",
            messages,
            temperature: 0.1,
            max_tokens: 3000,
        }, { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 60000 });
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return response.data.choices[0].message.content;
        }
        return '';
    }
    async callOllama(prompt, systemPrompt) {
        try {
            const response = await axios_1.default.post(`${this.ollamaUrl}/api/chat`, {
                model: "llama3",
                messages: [
                    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                    { role: 'user', content: prompt }
                ],
                stream: false,
                options: {
                    temperature: 0.1,
                    num_predict: 1500
                }
            }, { timeout: 60000 });
            return response.data.message.content;
        }
        catch (error) {
            const response = await axios_1.default.post(`${this.ollamaUrl}/api/generate`, {
                model: "llama3",
                prompt: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
                stream: false
            });
            return response.data.response;
        }
    }
    async callHuggingFace(prompt) {
        return "Hugging Face integration placeholder.";
    }
}
exports.LLMService = LLMService;
