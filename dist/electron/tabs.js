"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TabManager = void 0;
const electron_1 = require("electron");
const crypto_1 = require("crypto");
class TabManager {
    tabs = new Map();
    activeTabId = null;
    mainWindow;
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.mainWindow.on('resize', () => this.resizeActiveTab());
    }
    createTab(url = 'https://google.com') {
        const id = (0, crypto_1.randomUUID)();
        const view = new electron_1.BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
        });
        this.tabs.set(id, view);
        this.switchTab(id);
        this.navigateTab(id, url);
        view.webContents.on('did-finish-load', () => {
            this.mainWindow.webContents.send('tab:updated', {
                id,
                url: view.webContents.getURL(),
                title: view.webContents.getTitle(),
            });
        });
        // Handle new window requests (target="_blank") by opening in a new tab
        view.webContents.setWindowOpenHandler(({ url }) => {
            this.createTab(url);
            return { action: 'deny' };
        });
        return id;
    }
    switchTab(id) {
        const view = this.tabs.get(id);
        if (!view)
            return;
        if (this.activeTabId && this.tabs.has(this.activeTabId)) {
            this.mainWindow.removeBrowserView(this.tabs.get(this.activeTabId));
        }
        this.mainWindow.addBrowserView(view);
        this.activeTabId = id;
        this.resizeActiveTab();
    }
    closeTab(id) {
        const view = this.tabs.get(id);
        if (!view)
            return;
        if (this.activeTabId === id) {
            this.mainWindow.removeBrowserView(view);
            this.activeTabId = null;
        }
        view.webContents.destroy();
        this.tabs.delete(id);
    }
    navigateTab(id, url) {
        const view = this.tabs.get(id);
        if (!view)
            return;
        if (!url)
            return;
        const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
        view.webContents.loadURL(formattedUrl).catch(err => {
            console.error(`Failed to load URL ${formattedUrl}:`, err);
        });
    }
    resizeActiveTab() {
        if (!this.activeTabId)
            return;
        const view = this.tabs.get(this.activeTabId);
        if (!view)
            return;
        const [width, height] = this.mainWindow.getContentSize();
        const viewWidth = Math.max(100, width - 350);
        const viewHeight = Math.max(100, height - 80);
        view.setBounds({ x: 0, y: 80, width: viewWidth, height: viewHeight });
    }
    async extractContent(id) {
        const view = this.tabs.get(id);
        if (!view)
            return '';
        try {
            return await view.webContents.executeJavaScript('document.documentElement.outerHTML');
        }
        catch (e) {
            return '';
        }
    }
    async getSimplifiedDom(id) {
        const view = this.tabs.get(id);
        if (!view)
            return 'Error: Tab not found';
        try {
            return await view.webContents.executeJavaScript(`
        (function() {
          try {
            document.querySelectorAll('[data-agent-id]').forEach(el => el.removeAttribute('data-agent-id'));
            
            const interactiveSelector = [
              'button', 'a', 'input', 'select', 'textarea',
              '[role="button"]', '[role="link"]', '[role="textbox"]', '[role="searchbox"]',
              '[role="combobox"]', '[role="option"]', '[role="menuitem"]', '[role="tab"]',
              '[role="checkbox"]', '[role="radio"]', '[role="switch"]',
              '[contenteditable="true"]', '[onclick]', '[tabindex="0"]'
            ].join(',');

            let elements = Array.from(document.querySelectorAll(interactiveSelector)).map(el => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              return { el, rect, style };
            }).filter(item => {
              const isVisible = item.rect.width > 2 && item.rect.height > 2 && 
                               item.style.visibility !== 'hidden' && 
                               item.style.display !== 'none' && 
                               item.style.opacity !== '0' &&
                               item.style.pointerEvents !== 'none';
              if (!isVisible) return false;
              
              return (
                item.rect.top < window.innerHeight &&
                item.rect.bottom > 0 &&
                item.rect.left < window.innerWidth &&
                item.rect.right > 0
              );
            });

            // Improved Filtering:
            // 1. Remove containers that wrap other interactive elements
            // 2. Remove huge elements (> 90% of viewport) that aren't inputs
            const filteredElements = elements.filter(outer => {
              const isParent = elements.some(inner => {
                if (outer.el === inner.el) return false;
                return outer.el.contains(inner.el);
              });

              const isTooLarge = (outer.rect.width > window.innerWidth * 0.9 && outer.rect.height > window.innerHeight * 0.9);
              const isActuallyInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(outer.el.tagName);

              // We keep it if it's a leaf element OR if it's a specific input type
              return (!isParent || isActuallyInput) && (!isTooLarge || isActuallyInput);
            });

            const tree = filteredElements.map(item => {
              const el = item.el;
              const tagName = el.tagName.toLowerCase();
              const type = (el.type || '').toString();
              const role = el.getAttribute('role') || '';
              const text = (el.innerText || "").trim().substring(0, 80).replace(/\\n/g, ' ');
              const value = (el.value || (el.hasAttribute('contenteditable') ? el.innerText : '') || '').toString().substring(0, 50);
              const placeholder = el.getAttribute('placeholder') || '';
              const ariaLabel = el.getAttribute('aria-label') || '';
              const title = el.getAttribute('title') || '';
              const name = el.getAttribute('name') || '';

              // Clean up attributes
              const attr = {
                type: type || undefined,
                role: role || undefined,
                placeholder: placeholder || undefined,
                'aria-label': ariaLabel || undefined,
                title: title || undefined,
                name: name || undefined,
                value: value || undefined
              };

              const attrStr = Object.entries(attr)
                .filter(([_, v]) => v)
                .map(([k, v]) => k + '="' + v + '"')
                .join(' ');

              const representation = '[' + tagName + (attrStr ? ' ' + attrStr : '') + ']' + (text ? ' "' + text + '"' : '');

              return {
                el,
                representation,
                isFocused: document.activeElement === el,
                top: item.rect.top,
                left: item.rect.left
              };
            });

            // Sort: Natural reading order
            tree.sort((a, b) => {
              if (Math.abs(a.top - b.top) < 15) return a.left - b.left;
              return a.top - b.top;
            });

            const finalTree = tree.slice(0, 120).map((t, index) => {
              const agentId = (index + 1).toString();
              t.el.setAttribute('data-agent-id', agentId);
              return { ...t, agentId };
            });

            const header = 'PAGE: ' + document.title + '\\nURL: ' + window.location.href + '\\n\\n';
            const body = finalTree.map(t => {
              return '[' + t.agentId + '] ' + t.representation + (t.isFocused ? ' (FOCUSED)' : '');
            }).join('\\n');


            if (finalTree.length === 0) return header + "No interactive elements found.";
            return header + body;
          } catch (err) { return "ERROR: " + err.message; }
        })()
      `);
        }
        catch (e) {
            return 'FATAL ERROR: ' + e.message;
        }
    }
    async clickById(id, agentId) {
        const view = this.tabs.get(id);
        if (!view)
            return false;
        try {
            const idStr = agentId.toString().replace(/[\[\]]/g, '').trim();
            const result = await view.webContents.executeJavaScript(`
        (function() {
          const el = document.querySelector('[data-agent-id="${idStr}"]');
          if (!el) return null;
          
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          
          // Visual Feedback
          const originalOutline = el.style.outline;
          el.style.outline = '3px solid red';
          setTimeout(() => el.style.outline = originalOutline, 1000);

          const r = el.getBoundingClientRect();
          return { x: r.left + r.width/2, y: r.top + r.height/2 };
        })()
      `);
            if (result) {
                const opts = { x: Math.round(result.x), y: Math.round(result.y), button: 'left', clickCount: 1 };
                view.webContents.sendInputEvent({ type: 'mouseMove', x: opts.x, y: opts.y });
                await new Promise(r => setTimeout(r, 50));
                view.webContents.sendInputEvent({ type: 'mouseDown', ...opts });
                await new Promise(r => setTimeout(r, 30));
                view.webContents.sendInputEvent({ type: 'mouseUp', ...opts });
                await view.webContents.executeJavaScript(`
          (function() {
            const el = document.querySelector('[data-agent-id="${idStr}"]');
            if (el) {
              el.focus();
              const events = ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup'];
              events.forEach(type => {
                const ev = new MouseEvent(type, { bubbles: true, cancelable: true, view: window, buttons: 1 });
                el.dispatchEvent(ev);
              });
              if (typeof el.click === 'function') el.click();
            }
          })()
        `);
                return true;
            }
            return false;
        }
        catch (e) {
            return false;
        }
    }
    async typeById(id, agentId, text) {
        const view = this.tabs.get(id);
        if (!view)
            return false;
        try {
            const idStr = agentId.toString().replace(/[\[\]]/g, '').trim();
            // 1. Focus and Prepare the element
            const info = await view.webContents.executeJavaScript(`
        (function() {
          let el = document.querySelector('[data-agent-id="${idStr}"]');
          if (!el) return null;
          
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          el.focus();
          
          // Visual Feedback
          const originalOutline = el.style.outline;
          el.style.outline = '3px solid blue';
          setTimeout(() => el.style.outline = originalOutline, 1000);

          // Clear current value for fresh input (Using native setter bypass to avoid React issues)
          const nativeValueSetter = Object.getOwnPropertyDescriptor(
            el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype, 
            "value"
          )?.set;

          if (nativeValueSetter) {
            nativeValueSetter.call(el, '');
          } else {
            el.value = '';
          }
          
          el.dispatchEvent(new Event('input', { bubbles: true }));
          
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width/2, y: r.top + r.height/2 };
        })()
      `);
            if (info) {
                // 2. Click to ensure focus and cursor placement
                const clickOpts = { x: Math.round(info.x), y: Math.round(info.y), button: 'left', clickCount: 1 };
                view.webContents.sendInputEvent({ type: 'mouseDown', ...clickOpts });
                view.webContents.sendInputEvent({ type: 'mouseUp', ...clickOpts });
                await new Promise(r => setTimeout(r, 100));
                // 3. Native Key Simulation
                for (const char of text) {
                    view.webContents.sendInputEvent({ type: 'char', keyCode: char });
                    await new Promise(r => setTimeout(r, 10));
                }
                // 4. Force synchronization
                await view.webContents.executeJavaScript(`
          (function() {
            const el = document.querySelector('[data-agent-id="${idStr}"]') || document.activeElement;
            if (el) {
              ['input', 'change', 'blur'].forEach(type => {
                el.dispatchEvent(new Event(type, { bubbles: true }));
              });
            }
          })()
        `);
                return true;
            }
            return false;
        }
        catch (e) {
            return false;
        }
    }
    async scrapePage(id, query) {
        const view = this.tabs.get(id);
        if (!view)
            return '';
        try {
            return await view.webContents.executeJavaScript(`
        (function() {
          const bodyText = document.body.innerText;
          const tables = Array.from(document.querySelectorAll('table')).map(t => t.innerText).join('\\n\\n');
          const links = Array.from(document.querySelectorAll('a')).map(a => a.href + " (" + a.innerText + ")").join('\\n');
          return "BODY TEXT:\\n" + bodyText.substring(0, 15000) + "\\n\\nTABLES:\\n" + tables + "\\n\\nLINKS:\\n" + links.substring(0, 8000);
        })()
      `);
        }
        catch (e) {
            return 'Error scraping: ' + e;
        }
    }
    async pressKey(id, key) {
        const view = this.tabs.get(id);
        if (!view)
            return false;
        try {
            // Simulate full key sequence
            view.webContents.sendInputEvent({ type: 'keyDown', keyCode: key });
            view.webContents.sendInputEvent({ type: 'char', keyCode: key });
            await new Promise(r => setTimeout(r, 50));
            view.webContents.sendInputEvent({ type: 'keyUp', keyCode: key });
            return true;
        }
        catch (e) {
            return false;
        }
    }
    async waitForIdle(id, timeout = 10000) {
        const view = this.tabs.get(id);
        if (!view)
            return;
        try {
            await view.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const check = () => {
            if (document.readyState === "complete") {
              setTimeout(resolve, 1000);
            } else {
              window.addEventListener("load", () => setTimeout(resolve, 1000), { once: true });
            }
          };
          check();
          setTimeout(resolve, ${timeout});
        })
      `);
        }
        catch (e) { }
    }
    async takeScreenshot(id) {
        const view = this.tabs.get(id);
        if (!view)
            return null;
        try {
            const image = await view.webContents.capturePage();
            const base64 = image.toDataURL();
            return base64;
        }
        catch (e) {
            console.error('Screenshot failed:', e);
            return null;
        }
    }
    async scrollPage(id, direction) {
        const view = this.tabs.get(id);
        if (!view)
            return false;
        try {
            const scrollAmount = direction === 'down' ? 600 : -600;
            await view.webContents.executeJavaScript('window.scrollBy({ top: ' + scrollAmount + ', behavior: "smooth" });');
            return true;
        }
        catch (e) {
            return false;
        }
    }
}
exports.TabManager = TabManager;
