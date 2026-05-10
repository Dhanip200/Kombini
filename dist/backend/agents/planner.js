"use strict";
// ========================================
// planner.ts
// ========================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.Planner = void 0;
class Planner {
    llmService;
    constructor(llmService) {
        this.llmService = llmService;
    }
    async getNextAction(task, currentUrl, simplifiedDom, memory, loopWarning) {
        try {
            const memoryContext = memory.length > 0
                ? memory.map(m => `- ${m.tool}: ${m.target || m.text || ''} ${m.success === false ? '(FAILED)' : '(SUCCESS)'} ${m.thought ? `(Thought: ${m.thought})` : ''}`).join('\n')
                : 'No actions taken yet.';
            const systemPrompt = `You are a Universal Web Automation Expert. Your goal is to fulfill the user's task on ANY website using the provided PAGE STRUCTURE.

STRICT JSON FORMAT:
{
  "thought": "Reasoning (e.g., 'I see a search field classified as {SEARCH}, I will use the search tool.')",
  "tool": "click" | "type" | "search" | "open_url" | "wait" | "scrape" | "done",
  "agentId": "number",
  "text": "text content",
  "url": "full_url",
  "plan": ["step 1", "step 2", "..."]
}

UNIVERSAL RULES:
1. IDENTIFY: Look at {CLASSIFICATION} tags and [Context: ...] labels. They describe what an input or button does.
2. SEARCH: For any search bar, use the "search" tool. It handles typing and Enter automatically.
3. SCRAPE: To extract data from the page, use the "scrape" tool. Describe what you want to extract in the "text" field.
4. FLOW: For multi-step tasks (Login, Email, Checkout):
   - Fill all visible fields first.
   - Click the primary action button (Login, Send, Continue).
5. VERIFY: Check (value: "...") to see if your typing worked.
6. OVERLAYS: Elements at the top of the list are usually popups or foreground windows.
7. DONE: When you see a success message or the final results, use "done".
8. Only output the JSON object.`;
            const prompt = `USER TASK: ${task}
CURRENT URL: ${currentUrl}
PREVIOUS ACTIONS:
${memoryContext}

PAGE STRUCTURE:
${simplifiedDom}
`;
            const response = await this.llmService.callLLM(prompt, systemPrompt);
            console.log('AI Decision:', response);
            const action = this.parseAction(response);
            return action;
        }
        catch (error) {
            console.error('Planner Error:', error);
            return { thought: "Error occurred, waiting...", tool: 'wait', args: { ms: 3000 } };
        }
    }
    parseAction(raw) {
        console.log('--- AI RAW RESPONSE ---\n', raw);
        try {
            const jsonBlocks = raw.match(/\{[\s\S]*?\}/g);
            if (!jsonBlocks)
                return null;
            for (const block of jsonBlocks) {
                try {
                    const parsed = JSON.parse(block);
                    if (parsed && parsed.tool) {
                        // Robustly sanitize agentId: strip brackets, quotes, spaces
                        let agentId = parsed.agentId;
                        if (agentId !== undefined && agentId !== null) {
                            agentId = agentId.toString().replace(/[\[\]]/g, '').trim();
                        }
                        return {
                            thought: parsed.thought || '',
                            tool: parsed.tool,
                            plan: parsed.plan || [],
                            args: {
                                ...parsed,
                                agentId: agentId,
                                text: parsed.text || '',
                                url: parsed.url,
                                isDone: parsed.tool === 'done'
                            }
                        };
                    }
                }
                catch (e) {
                    continue;
                }
            }
            return null;
        }
        catch (e) {
            console.error('Failed to parse AI response:', raw);
            return null;
        }
    }
}
exports.Planner = Planner;
