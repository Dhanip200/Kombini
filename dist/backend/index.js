"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv = __importStar(require("dotenv"));
const llm_service_1 = require("./providers/llm.service");
const session_brain_1 = require("./memory/session-brain");
const research_agent_1 = require("./agents/research-agent");
const planner_1 = require("./agents/planner");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
dotenv.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
const llmService = new llm_service_1.LLMService();
const sessionBrain = new session_brain_1.SessionBrain();
const researchAgent = new research_agent_1.ResearchAgent(llmService, sessionBrain);
const planner = new planner_1.Planner(llmService);
app.post('/api/voice-command', async (req, res) => {
    console.log('Starting voice command recognition...');
    const scriptPath = path_1.default.join(process.cwd(), 'speech_to_text.py');
    const timeout = setTimeout(() => {
        console.warn('Voice command recognition timed out.');
        res.status(504).json({ error: 'Recognition timed out' });
    }, 15000);
    (0, child_process_1.exec)(`python "${scriptPath}"`, (error, stdout, stderr) => {
        clearTimeout(timeout);
        if (error) {
            console.error(`Voice command error: ${error}`);
            // Fallback for demo/dev purposes if python is not set up
            return res.status(500).json({ error: 'Recognition failed', details: error.message });
        }
        try {
            const lines = stdout.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            const result = JSON.parse(lastLine);
            if (result.error) {
                return res.status(400).json({ error: result.error });
            }
            console.log('Voice command recognized:', result.text);
            res.json({ text: result.text });
        }
        catch (e) {
            console.error('Failed to parse python output:', stdout);
            res.status(500).json({ error: 'Parse failure', stdout });
        }
    });
});
app.post('/api/summarize', async (req, res) => {
    try {
        const { html, url } = req.body;
        const summary = await llmService.summarize(html);
        sessionBrain.storePage(url, html, summary);
        res.json({ summary });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/compare', async (req, res) => {
    try {
        const { urls } = req.body;
        const pages = urls.map((url) => sessionBrain.getPage(url)).filter(Boolean);
        const comparison = await llmService.compare(pages);
        res.json({ comparison });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/research', async (req, res) => {
    try {
        const { topic } = req.body;
        const report = await researchAgent.performResearch(topic);
        res.json({ report });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/agent/next-action', async (req, res) => {
    console.log('Agent request received for task:', req.body.task);
    try {
        const { task, currentUrl, simplifiedDom, memory, loopWarning } = req.body;
        const action = await planner.getNextAction(task, currentUrl, simplifiedDom, memory || [], loopWarning);
        if (!action) {
            console.warn('Planner failed to return an action. Sending wait action.');
            return res.json({ action: { thought: "I am thinking...", tool: "wait", args: { ms: 2000 } } });
        }
        console.log('Agent action decided:', JSON.stringify(action));
        res.json({ action });
    }
    catch (error) {
        console.error('Agent next-action error:', error.message);
        res.status(500).json({ action: { thought: "Error occurred, waiting...", tool: "wait", args: { ms: 3000 } } });
    }
});
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});
const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Backend running on http://0.0.0.0:${PORT}`);
});
