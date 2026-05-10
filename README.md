# Comet AI Browser Agent

Comet is a production-quality AI-powered browser automation system. It allows users to perform complex web tasks using natural language commands. The system uses a multi-modal approach (text + future vision) and a robust tool system to interact with websites intelligently.

## Features

- **Autonomous Agent**: Fulfills complex, multi-step tasks using LLM reasoning.
- **Multi-Tab Management**: Handles multiple browser sessions seamlessly within an Electron environment.
- **Intelligent DOM Analysis**: Simplifies the page structure for AI, focusing on interactive elements and semantic context.
- **Robust Tools**: Support for clicking, typing, searching, scraping, scrolling, and more.
- **Email Integration**: Built-in capability to send emails automatically.
- **Multi-LLM Support**: Integrated with Gemini (Flash 1.5), NVIDIA Llama 3.1, and Ollama.
- **Voice Commands**: Support for natural language voice input.
- **Modern UI**: Clean, responsive interface with activity logs and execution plans.

## Project Structure

- `/backend`: Express server handling LLM reasoning, research, and external services (Email).
- `/frontend`: React-based UI for the browser and agent interaction.
- `/electron`: Main process and tab management using Electron's `BrowserView`.
- `/shared`: Common types and utilities shared across all components.

## Getting Started

### Prerequisites

- Node.js (v18+)
- Python (for voice commands, optional)
- Gemini API Key (or NVIDIA/Ollama setup)

### Setup

1.  **Clone the repository**.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure environment variables**:
    Create a `.env` file in the root directory (see `.env.example` for reference).
    ```env
    LLM_PROVIDER=gemini
    GEMINI_API_KEY=your_key_here
    SERPER_API_KEY=your_key_here
    EMAIL_HOST=smtp.gmail.com
    EMAIL_USER=your_email@gmail.com
    EMAIL_PASS=your_app_password
    ```
4.  **Build the project**:
    ```bash
    npm run build:backend
    npm run build:frontend
    npm run build:electron
    ```

### Running

- **Development**:
  Run backend and frontend in separate terminals:
  ```bash
  npm run dev:backend
  npm run dev:frontend
  npm run dev:electron
  ```

- **Production**:
  ```bash
  npm start
  ```

## Example Commands

- "Go to YouTube and find the latest AI news from today"
- "Scrape all product names and prices from this Amazon search result"
- "Summarize this article and email it to test@example.com"
- "Search for local weather and tell me if I should bring an umbrella"

## Roadmap

- [ ] **Vision Support**: Implement screenshot analysis for complex UIs that text-only DOM analysis misses.
- [ ] **User Feedback Loop**: Allow the agent to ask the user for clarification or missing information (e.g., OTPs).
- [ ] **Persistent Memory**: Use a vector database (like Pinecone or local Chroma) for long-term knowledge storage.
- [ ] **File Management**: Support for downloading files and analyzing their content (PDF, CSV).
- [ ] **Plugin System**: Allow developers to add custom tools for specific websites or workflows.
- [ ] **Improved Robustness**: Advanced self-correction and reflection steps after every action.
- [ ] **Multi-Agent Collaboration**: Multiple specialized agents working together on complex research tasks.

## License

MIT
