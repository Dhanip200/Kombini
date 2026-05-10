import axios from 'axios';

export class SearchService {
  private serperApiKey: string | undefined;

  constructor() {
    this.serperApiKey = process.env.SERPER_API_KEY;
  }

  async search(query: string): Promise<string[]> {
    if (this.serperApiKey) {
      return await this.searchSerper(query);
    } else {
      console.warn('SERPER_API_KEY not found. Falling back to mocked search.');
      return [
        `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`
      ];
    }
  }

  private async searchSerper(query: string): Promise<string[]> {
    try {
      const response = await axios.post(
        'https://google.serper.dev/search',
        { q: query },
        {
          headers: {
            'X-API-KEY': this.serperApiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data.organic.map((result: any) => result.link).slice(0, 3);
    } catch (error) {
      console.error('Serper Search Error:', error);
      return [];
    }
  }
}
