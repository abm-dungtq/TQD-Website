// Chat panel for the website agent, loaded on the first open. Desktop: a floating panel beside the mascot.
// Phones: a bottom sheet that is a history entry, so Back closes it. Replies stream from /api/chat as SSE
// and are rendered through parseReply, which only ever produces text nodes and links to this site.
import { parseReply, type Inline } from '../lib/chat-render';
import { EASE, play, SPRING } from './motion';

type Role = 'user' | 'agent' | 'error';
type Entry = { role: Role; text: string; zalo?: boolean };
type Saved = { visitor: string; entries: Entry[] };
export type ChatSignal = 'open' | 'close' | 'wait' | 'stream' | 'idle' | 'offline' | 'online';

const STORE = 'tqd-chat';
const KEEP = 40;
const STALL_MS = 45_000;
const STATUS_TTL = 60_000;
const NARROW = window.matchMedia('(max-width: 1023px)');
const GREETING = 'Tôi là phiên bản Agent của DũngTQ, bạn có thể tìm hiểu các kiến thức về AI từ tôi. Bạn muốn hỏi gì?';

const panel = document.querySelector<HTMLElement>('[data-chat]');
const scrim = document.querySelector<HTMLElement>('[data-chat-scrim]');
if (!panel || !scrim) throw new Error('chat panel missing');
const q = <T extends HTMLElement>(sel: string) => panel.querySelector<T>(sel)!;
const log = q<HTMLElement>('[data-chat-log]');
const form = q<HTMLFormElement>('[data-chat-form]');
const input = q<HTMLTextAreaElement>('[data-chat-input]');
const sendButton = q<HTMLButtonElement>('[data-chat-send]');
const newButton = q<HTMLButtonElement>('[data-chat-new]');
const offlineBox = q<HTMLElement>('[data-chat-offline]');
const sub = q<HTMLElement>('[data-chat-sub]');
const avatar = q<HTMLImageElement>('[data-chat-avatar]');
const zalo = panel.dataset.zalo ?? '';
const fallback = document.querySelector<HTMLElement>('[data-fallback]');
const skipLink = document.querySelector<HTMLElement>('[data-skip]');
const fab = document.querySelector<HTMLButtonElement>('[data-chat-fab]');

// Outside [data-fallback] and the desktop shell, so either can be hidden or made inert around it.
document.body.appendChild(scrim);
document.body.appendChild(panel);

const emit = (signal: ChatSignal) => window.dispatchEvent(new CustomEvent<ChatSignal>('tqd:chat', { detail: signal }));

const load = (): Saved => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) ?? '') as Saved;
    if (typeof saved.visitor === 'string' && Array.isArray(saved.entries)) return saved;
  } catch {
    /* first visit in this tab */
  }
  return { visitor: crypto.randomUUID(), entries: [] };
};
const state = load();
const save = () => {
  state.entries = state.entries.slice(-KEEP);
  try {
    sessionStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    /* storage full or blocked: the conversation still works for this page */
  }
};

let isOpen = false;
let busy = false;
let online: boolean | null = null;
let checkedAt = 0;
let opener: HTMLElement | null = null;

// ---- Rendering ----

const inlineNodes = (parts: Inline[]): Node[] =>
  parts.map((part) => {
    if (part.kind === 'text') return document.createTextNode(part.text);
    if (part.kind === 'bold') {
      const strong = document.createElement('strong');
      strong.textContent = part.text;
      return strong;
    }
    const a = document.createElement('a');
    a.href = part.href;
    a.textContent = part.text;
    return a;
  });

// appendChild rather than append: the Workers types redeclare Element.append for HTMLRewriter.
const put = (parent: Node, nodes: Node[]) => nodes.forEach((node) => parent.appendChild(node));

const renderReply = (el: HTMLElement, text: string) => {
  el.replaceChildren(
    ...parseReply(text).map((block) => {
      if (block.kind === 'p') {
        const p = document.createElement('p');
        block.lines.forEach((line, i) => {
          if (i) p.appendChild(document.createElement('br'));
          put(p, inlineNodes(line));
        });
        return p;
      }
      const list = document.createElement(block.kind);
      for (const item of block.items) {
        const li = document.createElement('li');
        put(li, inlineNodes(item));
        list.appendChild(li);
      }
      return list;
    }),
  );
};

const bubble = (entry: Entry): HTMLElement => {
  const el = document.createElement('div');
  el.className = 'chat-msg';
  el.dataset.role = entry.role;
  if (entry.role === 'agent') renderReply(el, entry.text);
  else {
    const p = document.createElement('p');
    p.textContent = entry.text;
    el.appendChild(p);
  }
  if (entry.zalo && zalo) {
    const a = document.createElement('a');
    a.href = zalo;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Nhắn Zalo cho DũngTQ';
    const p = document.createElement('p');
    p.appendChild(a);
    el.appendChild(p);
  }
  return el;
};

const scrollDown = () => {
  log.scrollTop = log.scrollHeight;
};

const renderAll = () => {
  log.replaceChildren(bubble({ role: 'agent', text: GREETING }), ...state.entries.map(bubble));
  scrollDown();
};

const add = (entry: Entry) => {
  state.entries.push(entry);
  save();
  log.appendChild(bubble(entry));
  scrollDown();
};

// ---- Controls ----

const syncControls = () => {
  sendButton.disabled = busy || online === false || !input.value.trim();
  newButton.disabled = busy;
  input.disabled = online === false;
};

const grow = () => {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
};

const setOnline = (value: boolean) => {
  online = value;
  checkedAt = Date.now();
  offlineBox.hidden = value;
  sub.textContent = value ? 'Đang trực tuyến' : 'Đang nghỉ';
  emit(value ? 'online' : 'offline');
  const hadFocus = panel.contains(document.activeElement) || document.activeElement === document.body;
  syncControls();
  // A disabled textarea drops focus; keep it in the panel so Escape and Tab still work here.
  if (isOpen && hadFocus) (value ? input : q<HTMLElement>('[data-chat-retry]')).focus({ preventScroll: true });
};

const checkStatus = async (force = false) => {
  if (!force && online !== null && Date.now() - checkedAt < STATUS_TTL) return;
  try {
    const res = await fetch('/api/chat/status');
    setOnline(Boolean(((await res.json()) as { online?: boolean }).online));
  } catch {
    setOnline(false);
  }
};

// ---- Sending and streaming ----

type Outcome = { text: string; done: boolean };

/** Reads the SSE body, calling onText as content arrives. Aborts when nothing arrives for STALL_MS. */
const readStream = async (res: Response, controller: AbortController, onText: (text: string) => void): Promise<Outcome> => {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let done = false;
  let stall = window.setTimeout(() => controller.abort(), STALL_MS);
  try {
    while (!done) {
      const { value, done: ended } = await reader.read();
      if (ended) break;
      clearTimeout(stall);
      stall = window.setTimeout(() => controller.abort(), STALL_MS);
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          done = true;
          break;
        }
        try {
          const chunk = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
          const piece = chunk.choices?.[0]?.delta?.content;
          if (piece) {
            text += piece;
            onText(text);
          }
        } catch {
          /* keep-alive or a partial line */
        }
      }
    }
  } catch (e) {
    // A stall after some text keeps what arrived; the caller reports the answer as cut off.
    if (!text) throw e;
  } finally {
    clearTimeout(stall);
    if (!done) await reader.cancel().catch(() => {});
  }
  return { text, done };
};

const send = async (message: string) => {
  busy = true;
  input.value = '';
  grow();
  syncControls();
  add({ role: 'user', text: message });

  const pending = document.createElement('div');
  pending.className = 'chat-msg';
  pending.dataset.role = 'agent';
  // Hidden from assistive tech while it streams; the finished answer is appended as a new message.
  pending.setAttribute('aria-hidden', 'true');
  pending.innerHTML = '<span class="chat-dots"><span></span><span></span><span></span></span>';
  log.appendChild(pending);
  log.setAttribute('aria-busy', 'true');
  scrollDown();
  emit('wait');

  const fail = (text: string, withZalo = false) => {
    pending.remove();
    add({ role: 'error', text, zalo: withZalo });
  };
  const controller = new AbortController();
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, visitorId: state.visitor }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (body.error === 'offline') {
        pending.remove();
        setOnline(false);
      } else fail(body.message ?? 'Agent chưa trả lời được. Bạn thử lại sau nhé.', res.status === 429);
      return;
    }

    let frame = 0;
    let latest = '';
    let started = false;
    const { text, done } = await readStream(res, controller, (t) => {
      latest = t;
      if (!started) {
        started = true;
        emit('stream');
      }
      // GoClaw reports a failure as content starting with "Error: "; never show its raw text.
      if (latest.startsWith('Error: ')) return;
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        renderReply(pending, latest);
        scrollDown();
      });
    });
    cancelAnimationFrame(frame);

    if (!text.trim() || text.startsWith('Error: ')) {
      fail('Agent gặp lỗi khi trả lời. Bạn thử hỏi lại nhé.');
      return;
    }
    pending.remove();
    add({ role: 'agent', text });
    if (!done) add({ role: 'error', text: 'Câu trả lời bị ngắt giữa chừng. Bạn thử hỏi lại nhé.' });
  } catch {
    fail(
      controller.signal.aborted
        ? 'Agent trả lời quá lâu. Bạn thử lại sau nhé.'
        : 'Mất kết nối. Kiểm tra mạng rồi thử lại nhé.',
    );
  } finally {
    busy = false;
    log.setAttribute('aria-busy', 'false');
    emit('idle');
    syncControls();
    if (isOpen && !NARROW.matches) input.focus({ preventScroll: true });
  }
};

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message || busy || online === false) return;
  void send(message);
});
input.addEventListener('keydown', (e) => {
  // isComposing: Vietnamese input methods use Enter to confirm a word.
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    form.requestSubmit();
  }
});
input.addEventListener('input', () => {
  grow();
  syncControls();
});
newButton.addEventListener('click', () => {
  if (busy) return;
  state.visitor = crypto.randomUUID();
  state.entries = [];
  save();
  renderAll();
  input.focus({ preventScroll: true });
});
q<HTMLButtonElement>('[data-chat-retry]').addEventListener('click', () => void checkStatus(true));

// ---- Open and close ----

const setExpanded = (value: boolean) => {
  for (const el of document.querySelectorAll('[aria-controls="chat-panel"]')) el.setAttribute('aria-expanded', String(value));
};

const show = async () => {
  if (isOpen) return;
  isOpen = true;
  avatar.src ||= '/mascot/idle.webp';
  panel.hidden = false;
  // Modal only as a phone sheet; on desktop the windows stay usable beside it.
  panel.setAttribute('aria-modal', String(NARROW.matches));
  setExpanded(true);
  emit('open');
  void checkStatus();
  scrollDown();
  if (NARROW.matches) {
    scrim.hidden = false;
    if (fallback) fallback.inert = true;
    if (skipLink) skipLink.inert = true;
    if (fab) fab.inert = true;
    document.documentElement.style.overflow = 'hidden';
    q<HTMLElement>('[data-chat-close]').focus({ preventScroll: true });
    await Promise.all([
      play(panel, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 380, easing: SPRING }),
      play(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: EASE }),
    ]);
  } else {
    input.focus({ preventScroll: true });
    await play(panel, [{ opacity: 0, transform: 'scale(0.92) translateY(12px)' }, { opacity: 1, transform: 'none' }], {
      duration: 260,
      easing: SPRING,
    });
  }
};

const hide = async () => {
  if (!isOpen) return;
  isOpen = false;
  setExpanded(false);
  emit('close');
  const narrow = !scrim.hidden;
  await (narrow
    ? Promise.all([
        play(panel, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: 260, easing: EASE }),
        play(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: EASE }),
      ])
    : play(panel, [{ opacity: 1 }, { opacity: 0, transform: 'scale(0.96) translateY(8px)' }], { duration: 160, easing: EASE }));
  if (isOpen) return;
  panel.hidden = true;
  scrim.hidden = true;
  if (fallback) fallback.inert = false;
  if (skipLink) skipLink.inert = false;
  if (fab) fab.inert = false;
  document.documentElement.style.overflow = '';
  // The mascot may have been switched off while the chat was open.
  (opener?.isConnected && opener.offsetParent ? opener : fab)?.focus({ preventScroll: true });
};

/** On phones the sheet is a history entry, so Back and the close button agree. */
const requestClose = () => {
  if (history.state?.chat) history.back();
  else void hide();
};
window.addEventListener('popstate', () => {
  if (isOpen && !history.state?.chat) void hide();
});

export const openChat = (from: HTMLElement) => {
  opener = from;
  if (isOpen) {
    input.focus({ preventScroll: true });
    return;
  }
  if (NARROW.matches && !history.state?.chat) history.pushState({ ...history.state, chat: true }, '');
  void show();
};

export const toggleChat = (from: HTMLElement) => (isOpen ? requestClose() : openChat(from));

q<HTMLElement>('[data-chat-close]').addEventListener('click', requestClose);
scrim.addEventListener('click', requestClose);
panel.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // The desktop also closes its top window on Escape; this one belongs to the chat.
  e.stopPropagation();
  requestClose();
});
NARROW.addEventListener('change', () => {
  if (isOpen) requestClose();
});

// Drag the sheet header down to close it on phones.
const drag = q<HTMLElement>('[data-chat-drag]');
drag.addEventListener('pointerdown', (start) => {
  if (!NARROW.matches || (start.target as Element).closest('button, a')) return;
  drag.setPointerCapture(start.pointerId);
  let dy = 0;
  const move = (e: PointerEvent) => {
    dy = Math.max(0, e.clientY - start.clientY);
    panel.style.transform = `translateY(${dy}px)`;
  };
  const end = () => {
    drag.removeEventListener('pointermove', move);
    drag.removeEventListener('pointerup', end);
    drag.removeEventListener('pointercancel', end);
    panel.style.transform = '';
    if (dy > 110) requestClose();
  };
  drag.addEventListener('pointermove', move);
  drag.addEventListener('pointerup', end);
  drag.addEventListener('pointercancel', end);
});

renderAll();
syncControls();
