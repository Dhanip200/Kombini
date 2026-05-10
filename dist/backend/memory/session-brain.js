"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionBrain = void 0;
class SessionBrain {
    pages = new Map();
    tasks = [];
    storePage(url, html, summary) {
        this.pages.set(url, {
            url,
            html,
            summary,
            timestamp: Date.now(),
        });
    }
    getPage(url) {
        return this.pages.get(url);
    }
    getAllPages() {
        return Array.from(this.pages.values());
    }
    queryMemory(query) {
        // Simple filter for now
        return this.getAllPages().filter(p => p.summary.toLowerCase().includes(query.toLowerCase()) ||
            p.url.toLowerCase().includes(query.toLowerCase()));
    }
    storeTask(task) {
        this.tasks.push(task);
    }
    getRecentTasks() {
        return this.tasks.slice(-5);
    }
}
exports.SessionBrain = SessionBrain;
