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
                ? memory.slice(-10).map(m => `- ${m.tool}: ${m.target || m.text || ''} ${m.success === false ? '(FAILED)' : '(SUCCESS)'} ${m.thought ? `(Thought: ${m.thought})` : ''}`).join('\n')
                : 'No actions taken yet.';
            const systemPrompt = `You are a Universal Web Automation Expert. Your goal is to fulfill the user's task on ANY website using the provided PAGE STRUCTURE.

STRICT JSON FORMAT:
{
  "thought": "Reasoning (e.g., 'I see a search field classified as {SEARCH}, I will use the search tool.')",
  "tool": "click" | "type" | "search" | "open_url" | "wait" | "scrape" | "send_email" | "done",
  "agentId": "number",
  "text": "text content / query / email body",
  "url": "full_url",
  "subject": "email subject (for send_email)",
  "to": "recipient email (for send_email)",
  "plan": ["step 1", "step 2", "..."]
}

UNIVERSAL RULES:
1. IDENTIFY: Look at {CLASSIFICATION} tags and [Context: ...] labels. They describe what an input or button does.
2. SEARCH: For any search bar, use the "search" tool. It handles typing and Enter automatically.
3. SCRAPE: To extract data from the page, use the "scrape" tool. Describe what you want to extract in the "text" field.
4. EMAIL: To send an email, use "send_email". Provide "to", "subject", and "text" fields.
5. FLOW: For multi-step tasks:
   - Fill all visible fields first.
   - Click the primary action button (Login, Send, Continue).
6. VERIFY: Check (value: "...") to see if your typing worked.
7. OVERLAYS: Elements at the top of the list are usually popups or foreground windows.
8. DONE: When you see a success message or the final results, use "done".
9. Only output the JSON object.

${loopWarning ? loopWarning : ''}`;
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
            // 1. Clean up common markdown/text noise around JSON
            let cleaned = raw.trim();
            // Remove markdown code blocks if present
            if (cleaned.includes('```')) {
                const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (match)
                    cleaned = match[1].trim();
            }
            // 2. Extract potential JSON blocks using a more robust approach
            // We look for blocks starting with { and ending with }
            const jsonBlocks = [];
            let depth = 0;
            let start = -1;
            for (let i = 0; i < cleaned.length; i++) {
                if (cleaned[i] === '{') {
                    if (depth === 0)
                        start = i;
                    depth++;
                }
                else if (cleaned[i] === '}') {
                    depth--;
                    if (depth === 0 && start !== -1) {
                        jsonBlocks.push(cleaned.substring(start, i + 1));
                        start = -1;
                    }
                }
            }
            if (jsonBlocks.length === 0) {
                console.warn('No JSON blocks found in AI response');
                return null;
            }
            for (const block of jsonBlocks) {
                try {
                    // Pre-process block to fix common issues like trailing commas
                    const sanitizedBlock = block
                        .replace(/,\s*([\]\}])/g, '$1') // Trailing commas
                        .replace(/(\w+)\s*:/g, '"$1":') // Missing quotes on keys (if simple words)
                        .replace(/'/g, '"'); // Single quotes to double quotes (risky but often needed)
                    const parsed = JSON.parse(sanitizedBlock);
                    if (parsed && parsed.tool) {
                        let agentId = parsed.agentId;
                        if (agentId !== undefined && agentId !== null) {
                            agentId = agentId.toString().replace(/[\[\]]/g, '').trim();
                        }
                        console.log('Successfully parsed action:', parsed.tool);
                        return {
                            thought: parsed.thought || '',
                            tool: parsed.tool,
                            plan: parsed.plan || [],
                            args: {
                                ...parsed,
                                agentId: agentId,
                                text: parsed.text || '',
                                url: parsed.url,
                                to: parsed.to,
                                subject: parsed.subject,
                                isDone: parsed.tool === 'done'
                            }
                        };
                    }
                }
                catch (e) {
                    console.warn('Failed to parse JSON block:', e.message, 'Block:', block);
                    // Try original block if sanitized failed
                    try {
                        const parsed = JSON.parse(block);
                        if (parsed && parsed.tool) {
                            // Same logic as above...
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
                                    to: parsed.to,
                                    subject: parsed.subject,
                                    isDone: parsed.tool === 'done'
                                }
                            };
                        }
                    }
                    catch (e2) {
                        continue;
                    }
                }
            }
            return null;
        }
        catch (e) {
            console.error('Fatal error in parseAction:', e.message);
            return null;
        }
    }
}
exports.Planner = Planner;
