export interface PageData {
  url: string;
  html: string;
  summary: string;
  timestamp: number;
}

export interface TaskData {
  task: string;
  plan: string[];
  steps: any[];
  status: 'running' | 'completed' | 'failed';
}

export class SessionBrain {
  private pages: Map<string, PageData> = new Map();
  private tasks: TaskData[] = [];

  storePage(url: string, html: string, summary: string) {
    this.pages.set(url, {
      url,
      html,
      summary,
      timestamp: Date.now(),
    });
  }

  getPage(url: string): PageData | undefined {
    return this.pages.get(url);
  }

  getAllPages(): PageData[] {
    return Array.from(this.pages.values());
  }

  queryMemory(query: string): PageData[] {
    // Simple filter for now
    return this.getAllPages().filter(p => 
      p.summary.toLowerCase().includes(query.toLowerCase()) || 
      p.url.toLowerCase().includes(query.toLowerCase())
    );
  }

  storeTask(task: TaskData) {
    this.tasks.push(task);
  }

  getRecentTasks(): TaskData[] {
    return this.tasks.slice(-5);
  }
}
