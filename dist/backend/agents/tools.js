"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOLS = void 0;
exports.TOOLS = [
    {
        name: 'open_tab',
        description: 'Opens a new browser tab with the specified URL.',
        args: { url: 'string' }
    },
    {
        name: 'search_google',
        description: 'Navigates the current tab to Google Search with a query.',
        args: { query: 'string' }
    },
    {
        name: 'click',
        description: 'Clicks an element on the page identified by its visible text or label (e.g., "Search", "Login", "First video").',
        args: { text: 'string' }
    },
    {
        name: 'type',
        description: 'Types text into an input field identified by its label or placeholder (e.g., "Search", "Email").',
        args: { label: 'string', text: 'string' }
    },
    {
        name: 'summarize',
        description: 'Summarizes the content of the current page.',
        args: {}
    },
    {
        name: 'wait',
        description: 'Waits for a specified amount of time in milliseconds.',
        args: { ms: 'number' }
    },
    {
        name: 'scroll',
        description: 'Scrolls the page up or down.',
        args: { direction: 'up | down' }
    },
    {
        name: 'send_email',
        description: 'Triggers a system email compose window.',
        args: { to: 'string', subject: 'string', body: 'string' }
    }
];
