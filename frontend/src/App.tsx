import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Mic, MicOff, Plus, ChevronLeft, ChevronRight, RotateCcw, Activity, Send, Target, Layout } from 'lucide-react';
import { TabInfo, Action, AgentExecutionStep, ActionMemory } from '../../shared/types';

declare global {
  interface Window {
    electron: {
      createTab: (url?: string) => Promise<string>;
      switchTab: (id: string) => Promise<void>;
      closeTab: (id: string) => Promise<void>;
      navigateTab: (id: string, url: string) => Promise<void>;
      extractContent: (id: string) => Promise<string>;
      clickElement: (tabId: string, agentId: string) => Promise<boolean>;
      typeInto: (tabId: string, agentId: string, text: string) => Promise<boolean>;
      scrollPage: (tabId: string, direction: 'up' | 'down') => Promise<boolean>;
      pressKey: (tabId: string, key: string) => Promise<boolean>;
      getSimplifiedDom: (tabId: string) => Promise<string>;
      scrapePage: (tabId: string, query: string) => Promise<string>;
      takeScreenshot: (tabId: string) => Promise<string>;
      waitForIdle: (tabId: string) => Promise<void>;
      onTabUpdated: (callback: (data: any) => void) => void;
    };
  }
}

const App: React.FC = () => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const tabsRef = useRef<TabInfo[]>([]);
  const activeTabIdRef = useRef<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiSidebar, setAiSidebar] = useState<{ summary?: string; report?: string }>({});
  
  // Agent State
  const [agentTask, setAgentTask] = useState('');
  const [executionPlan, setExecutionPlan] = useState<AgentExecutionStep[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const isExecutingRef = useRef(false);

  // Speech Recording State
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);

  useEffect(() => {
    window.electron.onTabUpdated((data: any) => {
      setTabs((prev) => {
        const existing = prev.find(t => t.id === data.id);
        const updated = existing 
          ? prev.map((t) => (t.id === data.id ? { ...t, ...data } : t))
          : [...prev, { ...data }];
        tabsRef.current = updated;
        
        if (data.id === activeTabIdRef.current && data.url) {
          setUrlInput(data.url);
        }
        
        return updated;
      });
    });

    if (tabsRef.current.length === 0) {
      handleNewTab();
    }
  }, []);

  const handleNewTab = async (url?: string): Promise<string> => {
    const id = await window.electron.createTab(url);
    const initialUrl = typeof url === 'string' ? url : 'https://google.com';
    const newTab = { id, url: initialUrl, title: 'Loading...' };
    setTabs((prev) => {
      const updated = [...prev, newTab];
      tabsRef.current = updated;
      return updated;
    });
    setActiveTabId(id);
    activeTabIdRef.current = id;
    setUrlInput(initialUrl);
    return id;
  };

  const switchTab = (id: string) => {
    window.electron.switchTab(id);
    setActiveTabId(id);
    activeTabIdRef.current = id;
    const tab = tabsRef.current.find(t => t.id === id);
    if (tab) setUrlInput(tab.url);
  };

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTabId) {
      window.electron.navigateTab(activeTabId, urlInput);
    }
  };

  const startAgent = async (explicitTask?: string | React.MouseEvent) => {
    const taskToUse = (typeof explicitTask === 'string' ? explicitTask : agentTask);
    if (!taskToUse || taskToUse.trim() === '') return;

    setIsExecuting(true);
    isExecutingRef.current = true;
    setLoading(true);
    setExecutionPlan([]);
    setCurrentPlan([]);
    
    const memory: ActionMemory[] = [];
    let currentId = activeTabIdRef.current || activeTabId;
    let isDone = false;
    let consecutiveRepetitions = 0;
    let lastActionStr = "";

    try {
      while (!isDone && isExecutingRef.current) {
        if (!currentId) break;
        
        await window.electron.waitForIdle(currentId);
        const currentTab = tabsRef.current.find(t => t.id === currentId);
        const simplifiedDom = await window.electron.getSimplifiedDom(currentId);
        
        const loopWarning = consecutiveRepetitions >= 2 
          ? `WARNING: You are repeating the same action. Try a different strategy.` 
          : "";

        const response = await axios.post('http://127.0.0.1:3001/api/agent/next-action', { 
          task: taskToUse,
          currentUrl: currentTab?.url || 'about:blank',
          simplifiedDom,
          memory,
          loopWarning
        });

        const action: Action = response.data.action;
        if (!action) break;

        if (action.plan && action.plan.length > 0) {
          setCurrentPlan(action.plan);
        }

        const step: AgentExecutionStep = { thought: action.thought, action, status: 'running' };
        setExecutionPlan(prev => [...prev, step]);

        if (action.tool === 'done') {
          isDone = true;
          setExecutionPlan(prev => prev.map((s, i) => i === prev.length - 1 ? { ...s, status: 'completed' } : s));
          break;
        }

        let actionSuccess = false;
        let resultData = "";
        try {
          const result = await executeAction(action, currentId);
          actionSuccess = true;
          
          if (typeof result === 'string' && action.tool === 'scrape') {
            resultData = result;
          }

          const currentActionStr = JSON.stringify(action.args);
          if (currentActionStr === lastActionStr) consecutiveRepetitions++;
          else consecutiveRepetitions = 0;
          lastActionStr = currentActionStr;

          if (action.tool === 'open_tab' && typeof result === 'string') {
            currentId = result;
            setActiveTabId(result);
            activeTabIdRef.current = result;
          }

          setExecutionPlan(prev => prev.map((s, i) => i === prev.length - 1 ? { ...s, status: 'completed' } : s));
          
        } catch (e: any) {
          console.error("Action execution failed:", e);
          setExecutionPlan(prev => prev.map((s, i) => i === prev.length - 1 ? { ...s, status: 'failed' } : s));
          actionSuccess = false;
          consecutiveRepetitions++;
          await new Promise(r => setTimeout(r, 2000));
        }

        memory.push({
          thought: action.thought,
          tool: action.tool,
          target: action.args.agentId,
          text: action.args.text,
          success: actionSuccess,
          result: resultData,
          timestamp: Date.now()
        });
        if (memory.length > 20) memory.shift();

        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (error: any) {
      console.error("Fatal agent error:", error);
    } finally {
      setLoading(false);
      setIsExecuting(false);
      isExecutingRef.current = false;
    }
  };

  const executeAction = async (action: Action, tabId: string | null): Promise<string | null | boolean> => {
    let success = false;
    let newId = tabId;

    switch (action.tool) {
      case 'open_tab':
        if (action.args?.url) {
          newId = await handleNewTab(action.args.url);
          success = true;
          return newId;
        }
        break;
      case 'open_url':
        if (tabId && action.args?.url) {
          await window.electron.navigateTab(tabId, action.args.url);
          success = true;
        }
        break;
      case 'search_google':
        if (tabId && action.args?.query) {
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(action.args.query)}`;
          await window.electron.navigateTab(tabId, searchUrl);
          success = true;
        }
        break;
      case 'click':
        if (tabId && action.args?.agentId) {
          success = await window.electron.clickElement(tabId, action.args.agentId);
        }
        break;
      case 'type':
        if (tabId && action.args?.agentId) {
          success = await window.electron.typeInto(tabId, action.args.agentId, action.args.text || '');
        }
        break;
      case 'search':
        if (tabId && action.args?.agentId) {
          success = await window.electron.typeInto(tabId, action.args.agentId, action.args.text || '');
          if (success) {
            await new Promise(r => setTimeout(r, 500));
            success = await window.electron.pressKey(tabId, 'Enter');
          }
        }
        break;
      case 'press_key':
        if (tabId && action.args?.key) {
          success = await window.electron.pressKey(tabId, action.args.key);
        }
        break;
      case 'wait':
        await new Promise(r => setTimeout(r, action.args?.ms || 2000));
        success = true;
        break;
      case 'scroll':
        if (tabId && action.args?.direction) {
          success = await window.electron.scrollPage(tabId, action.args.direction);
        }
        break;
      case 'scrape':
        if (tabId) {
          const scrapedData = await window.electron.scrapePage(tabId, action.args?.text || '');
          return scrapedData;
        }
        break;
      case 'send_email':
        const emailRes = await axios.post('http://127.0.0.1:3001/api/send-email', {
          to: action.args.to,
          subject: action.args.subject,
          text: action.args.text
        });
        success = emailRes.data.success;
        break;
      default:
        console.warn('Unknown tool:', action.tool);
    }

    if (!success && action.tool !== 'wait') throw new Error(`Tool ${action.tool} failed`);
    return success;
  };

  return (
    <div className="app-container">
      <header className="browser-header">
        <div className="tab-container">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab-item ${activeTabId === tab.id ? 'active' : ''}`}
              onClick={() => switchTab(tab.id)}
            >
              <span className="tab-title">{tab.title}</span>
              <button className="close-tab-btn" onClick={(e) => { e.stopPropagation(); window.electron.closeTab(tab.id); }}>×</button>
            </div>
          ))}
          <button className="add-tab-btn" onClick={() => handleNewTab()}><Plus size={16} /></button>
        </div>
        
        <div className="nav-bar">
          <div className="nav-btns">
            <button className="nav-btn"><ChevronLeft size={18} /></button>
            <button className="nav-btn"><ChevronRight size={18} /></button>
            <button className="nav-btn" onClick={() => activeTabId && window.electron.navigateTab(activeTabId, urlInput)}><RotateCcw size={16} /></button>
          </div>
          <form className="address-bar" onSubmit={handleNavigate}>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Search or enter URL..."
            />
          </form>
        </div>
      </header>

      <div className="content-layout">
        <main className="web-view-placeholder">
          {/* Electron BrowserView will be mounted here by the main process */}
        </main>

        <aside className="agent-sidebar">
          <div className="sidebar-header">
            <Activity size={20} className="header-icon" />
            <h2>AI Assistant</h2>
          </div>

          <div className="task-input-section">
            <div className="input-group">
              <textarea 
                placeholder="What can I help you with today?"
                value={agentTask}
                onChange={(e) => setAgentTask(e.target.value)}
                rows={3}
              />
              <div className="input-actions">
                <button 
                  className={`voice-btn ${isListening ? 'listening' : ''}`}
                  onClick={() => {/* voice logic */}}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button 
                  className="execute-btn"
                  onClick={startAgent} 
                  disabled={loading || isExecuting || !agentTask}
                >
                  {isExecuting ? 'Running...' : <Send size={18} />}
                </button>
              </div>
            </div>
          </div>

          {currentPlan.length > 0 && (
            <div className="plan-section">
              <h3><Target size={16} /> Strategy</h3>
              <ul className="plan-list">
                {currentPlan.map((step, i) => (
                  <li key={i}>
                    <span className="step-num">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="activity-section">
            <h3><Activity size={16} /> Activity Log</h3>
            <div className="log-container">
              {executionPlan.length === 0 && <div className="empty-log">Waiting for task...</div>}
              {executionPlan.map((step, i) => (
                <div key={i} className={`log-item ${step.status}`}>
                  <div className="thought">{step.thought}</div>
                  <div className="action-details">
                    <span className="tool-tag">{step.action.tool}</span>
                    {step.action.args.agentId && <span className="id-tag">#{step.action.args.agentId}</span>}
                  </div>
                </div>
              )).reverse()}
            </div>
          </div>

          {isExecuting && (
            <button className="stop-btn" onClick={() => { isExecutingRef.current = false; setIsExecuting(false); }}>
              Stop Agent Execution
            </button>
          )}
        </aside>
      </div>
    </div>
  );
};

export default App;

