"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const axios_1 = __importDefault(require("axios"));
class SearchService {
    serperApiKey;
    constructor() {
        this.serperApiKey = process.env.SERPER_API_KEY;
    }
    async search(query) {
        if (this.serperApiKey) {
            return await this.searchSerper(query);
        }
        else {
            console.warn('SERPER_API_KEY not found. Falling back to mocked search.');
            return [
                `https://www.google.com/search?q=${encodeURIComponent(query)}`,
                `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`
            ];
        }
    }
    async searchSerper(query) {
        try {
            const response = await axios_1.default.post('https://google.serper.dev/search', { q: query }, {
                headers: {
                    'X-API-KEY': this.serperApiKey,
                    'Content-Type': 'application/json',
                },
            });
            return response.data.organic.map((result) => result.link).slice(0, 3);
        }
        catch (error) {
            console.error('Serper Search Error:', error);
            return [];
        }
    }
}
exports.SearchService = SearchService;
