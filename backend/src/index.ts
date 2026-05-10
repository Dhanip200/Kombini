import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { LLMService } from './providers/llm.service';
import { EmailService } from './providers/email.service';
import { SessionBrain } from './memory/session-brain';
import { ResearchAgent } from './agents/research-agent';
import { Planner } from './agents/planner';
import { exec } from 'child_process';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const llmService = new LLMService();
const emailService = new EmailService();
const sessionBrain = new SessionBrain();
const researchAgent = new ResearchAgent(llmService, sessionBrain);
const planner = new Planner(llmService);

app.post('/api/send-email', async (req, res) => {
  const { to, subject, text } = req.body;
  const success = await emailService.sendEmail(to, subject, text);
  res.json({ success });
});

app.post('/api/voice-command', async (req, res) => {
  console.log('Starting voice command recognition...');
  const scriptPath = path.join(process.cwd(), 'speech_to_text.py');
  
  const timeout = setTimeout(() => {
    console.warn('Voice command recognition timed out.');
    res.status(504).json({ error: 'Recognition timed out' });
  }, 15000);

  exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
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
    } catch (e) {
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/compare', async (req, res) => {
  try {
    const { urls } = req.body;
    const pages = urls.map((url: string) => sessionBrain.getPage(url)).filter(Boolean);
    const comparison = await llmService.compare(pages);
    res.json({ comparison });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/research', async (req, res) => {
  try {
    const { topic } = req.body;
    const report = await researchAgent.performResearch(topic);
    res.json({ report });
  } catch (e: any) {
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
  } catch (error: any) {
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
