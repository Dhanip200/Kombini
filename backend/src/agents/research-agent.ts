import { LLMService } from '../providers/llm.service';
import { SessionBrain } from '../memory/session-brain';
import { SearchService } from '../providers/search.service';
import axios from 'axios';

export class ResearchAgent {
  private searchService: SearchService;

  constructor(
    private llmService: LLMService,
    private sessionBrain: SessionBrain
  ) {
    this.searchService = new SearchService();
  }

  async performResearch(topic: string): Promise<string> {
    console.log(`Researching: ${topic}`);

    const searchResults = await this.searchService.search(topic);
    const reports: string[] = [];

    for (const url of searchResults) {
      try {
        console.log(`Fetching content from: ${url}`);
        const response = await axios.get(url, { 
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const html = response.data;
        const summary = await this.llmService.summarize(html);
        this.sessionBrain.storePage(url, html, summary);
        reports.push(`Source: ${url}\nSummary: ${summary}`);
      } catch (error: any) {
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

