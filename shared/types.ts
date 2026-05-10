export type ToolName =
  | 'open_tab'
  | 'open_url'
  | 'search_google'
  | 'click'
  | 'type'
  | 'search'
  | 'press_key'
  | 'scroll'
  | 'wait'
  | 'summarize'
  | 'scrape'
  | 'send_email'
  | 'done';

export interface Action {
  thought: string;
  tool: ToolName;
  args: any;
  plan?: string[];
}

export interface ActionMemory {
  thought?: string;
  tool: string;
  target?: string;
  text?: string;
  success?: boolean;
  result?: any;
  timestamp: number;
}

export interface TabInfo {
  id: string;
  url: string;
  title: string;
  summary?: string;
}

export interface AgentExecutionStep {
  thought: string;
  action: Action;
  status: 'pending' | 'running' | 'completed' | 'failed';
}
