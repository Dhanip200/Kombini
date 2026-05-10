"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResearchAgent = void 0;
const search_service_1 = require("../providers/search.service");
const axios_1 = __importDefault(require("axios"));
class ResearchAgent {
    llmService;
    sessionBrain;
    searchService;
    constructor(llmService, sessionBrain) {
        this.llmService = llmService;
        this.sessionBrain = sessionBrain;
        this.searchService = new search_service_1.SearchService();
    }
    async performResearch(topic) {
        console.log(`Researching: ${topic}`);
        const searchResults = await this.searchService.search(topic);
        const reports = [];
        for (const url of searchResults) {
            try {
                console.log(`Fetching content from: ${url}`);
                const response = await axios_1.default.get(url, {
                    timeout: 5000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
                });
                const html = response.data;
                const summary = await this.llmService.summarize(html);
                this.sessionBrain.storePage(url, html, summary);
                reports.push(`Source: ${url}\nSummary: ${summary}`);
            }
            catch (error) {
                console.error(`Failed to fetch ${url}:`, error.message);
            }
        }
        if (reports.length === 0) {
            return "I tried to research the topic but couldn't find any accessible information on the internet.";
        }
        const finalPrompt = `Based on the following research, produce a final comprehensive report about ${topic}:\n\n${reports.join('\n\n')}`;
        return await this.llmService.callLLM(finalPrompt);
    }
}
exports.ResearchAgent = ResearchAgent;
