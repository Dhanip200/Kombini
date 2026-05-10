// ========================================
// planner.ts
// ========================================

import { Action, ToolName, ActionMemory } from '../../../shared/types';
import { LLMService } from '../providers/llm.service';

export class Planner {
  constructor(private llmService: LLMService) {}

  async getNextAction(
    task: string,
    currentUrl: string,
    simplifiedDom: string,
    memory: ActionMemory[],
    loopWarning?: string
  ): Promise<Action | null> {
    try {
      const memoryContext = memory.length > 0 
        ? memory.slice(-10).map(m => `- ${m.tool}: ${m.target || m.text || ''} ${m.success === false ? '(FAILED)' : '(SUCCESS)'} ${m.thought ? `(Thought: ${m.thought})` : ''}`).join('\n')
        : 'No actions taken yet.';

      const systemPrompt = `You are a Universal Web Automation Expert. Your goal is to fulfill the user's task on ANY website using the provided PAGE STRUCTURE.

STRICT JSON FORMAT:
{
  "thought": "Reasoning (e.g., 'I see an <input> with placeholder=\"Search\", I will use the search tool.')",
  "tool": "click" | "type" | "search" | "open_url" | "wait" | "scrape" | "send_email" | "done",
  "agentId": "number",
  "text": "text content / query / email body",
  "url": "full_url",
  "subject": "email subject",
  "to": "recipient email",
  "plan": ["step 1", "step 2", "..."]
}

UNIVERSAL RULES:
1. IDENTIFY: Look at the tags and attributes:
   - [input type="text" placeholder="..."] is usually for typing.
   - [button] or [a] are for clicking.
   - Look for "search", "query", or "q" in attributes to find search bars.
2. SEARCH TOOL: For ANY search bar, use the "search" tool. It handles typing and Enter automatically. 
   - Example: If [1] is <input placeholder="Search">, use {"tool": "search", "agentId": "1", "text": "your query"}.
3. ELEMENTS: Use the [ID] provided in brackets to target elements.
4. NAVIGATION: If you aren't on the right site, use "open_url" with the full URL.
5. FLOW: 
   - Fill fields first, then click the submit/action button.
   - If a popup appears, it will be at the top or bottom of the list.
6. DONE: Use "done" only when the final goal is visible.

PAGE STRUCTURE FORMAT:
[ID] <tag attr="value"> "Text Content"`;


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
    } catch (error) {
      console.error('Planner Error:', error);
      return { thought: "Error occurred, waiting...", tool: 'wait', args: { ms: 3000 } };
    }
  }

  private parseAction(raw: string): Action | null {
    console.log('--- AI RAW RESPONSE ---\n', raw);
    try {
      // 1. Clean up common markdown/text noise around JSON
      let cleaned = raw.trim();
      
      // Remove markdown code blocks if present
      if (cleaned.includes('```')) {
        const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) cleaned = match[1].trim();
      }

      // 2. Extract potential JSON blocks using a more robust approach
      // We look for blocks starting with { and ending with }
      const jsonBlocks: string[] = [];
      let depth = 0;
      let start = -1;

      for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (cleaned[i] === '}') {
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
              tool: parsed.tool as ToolName,
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
        } catch (e: any) {
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
                tool: parsed.tool as ToolName,
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
          } catch (e2) {
             continue; 
          }
        }
      }
      return null;
    } catch (e: any) {
      console.error('Fatal error in parseAction:', e.message);
      return null;
    }
  }
}


