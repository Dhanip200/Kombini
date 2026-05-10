"use strict";
// ========================================
// executor.ts
// ========================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.Executor = void 0;
class Executor {
    page;
    history = [];
    constructor(page) {
        this.page = page;
    }
    async executeStep(step) {
        step.status = 'running';
        try {
            const result = await this.executeAction(step.action);
            step.status = 'completed';
            step.result = result;
        }
        catch (e) {
            step.status = 'failed';
            step.error = e.message;
            console.error('EXECUTION ERROR:', e);
        }
        this.history.push(step);
        return step;
    }
    async executeAction(action) {
        switch (action.tool) {
            case 'open_tab': {
                const { url } = action.args;
                console.log('OPEN URL:', url);
                await this.page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
                await this.page.waitForTimeout(3000);
                return true;
            }
            case 'search_google': {
                const { query } = action.args;
                const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                console.log('SEARCH GOOGLE:', query);
                await this.page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
                await this.page.waitForTimeout(3000);
                return true;
            }
            case 'click': {
                const { agentId } = action.args;
                const selector = `[data-agent-id="${agentId}"]`;
                console.log('CLICK:', selector);
                await this.page.waitForSelector(selector, {
                    timeout: 10000
                });
                await this.page.click(selector);
                await this.page.waitForTimeout(2500);
                return true;
            }
            case 'type': {
                const { agentId, text } = action.args;
                const selector = `[data-agent-id="${agentId}"]`;
                console.log('TYPE:', selector, text);
                await this.page.waitForSelector(selector, {
                    timeout: 10000
                });
                const element = await this.page.$(selector);
                if (!element) {
                    throw new Error(`Element not found: ${agentId}`);
                }
                await element.click({
                    clickCount: 3
                });
                await this.page.keyboard.press('Backspace');
                await element.type(text, {
                    delay: 20
                });
                await this.page.waitForTimeout(1000);
                return true;
            }
            case 'press_key': {
                const { key } = action.args;
                console.log('PRESS KEY:', key);
                await this.page.keyboard.press(key);
                await this.page.waitForTimeout(1000);
                return true;
            }
            case 'wait': {
                const { ms } = action.args;
                console.log('WAIT:', ms);
                await this.page.waitForTimeout(ms || 3000);
                return true;
            }
            case 'summarize': {
                console.log('TASK COMPLETE');
                return true;
            }
            default:
                console.log('UNKNOWN ACTION');
                return false;
        }
    }
    getHistory() {
        return this.history;
    }
}
exports.Executor = Executor;
