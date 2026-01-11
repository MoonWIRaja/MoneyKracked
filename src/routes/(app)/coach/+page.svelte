<script lang="ts">
  import { Header } from '$lib/components/layout';
  import { IsometricCard, PixelButton } from '$lib/components/ui';
  import { onMount, tick } from 'svelte';
  import type { PageData } from './$types';
  import { toggleSidebar } from '$lib/stores/app-store.svelte';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  interface BudgetAction {
    action: 'create' | 'update' | 'delete';
    categoryName: string;
    amount: number;
    period: 'monthly' | 'weekly' | 'yearly';
    month?: number;
    year?: number;
  }

  interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    budgetActions?: BudgetAction[];
  }

  interface ChatSession {
    sessionId: string;
    title: string;
    summary: string;
    lastMessageAt: Date;
    messageCount: number;
    topics: string[];
    sentiment?: string;
  }

  let messages = $state<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm **MonKrac** 🤖\n\nYour expert Financial Coach & Budget Advisor specializing in Malaysian personal finance.\n\nI have a **memory** and I **learn** from our conversations! The more we talk, the better I can help you.\n\nI can help you with:\n• **Setup your budget** - Tell me your salary and I'll create a personalized budget plan\n• **Analyze spending** - I'll review all your transactions and give smart tips\n• **Savings strategies** - Build emergency funds and achieve your financial goals\n• **Debt management** - Get advice on managing loans, credit cards, and PTPTN\n\nTry saying: \"Setup my budget, salary RM4500\" or \"Analyze my spending\"",
      timestamp: new Date()
    }
  ]);

  let input = $state('');
  let isLoading = $state(false);
  let pendingActions = $state<BudgetAction[] | null>(null);
  let applyingBudgets = $state(false);
  let sessionId = $state<string>(crypto.randomUUID());
  let learnedInfo = $state<string | null>(null);
  let suggestions = $state<string[]>([]);
  let isLoadingSuggestions = $state(true);

  let chatSessions = $state<ChatSession[]>([]);
  let isLoadingSessions = $state(false);
  let showSidebar = $state(true);
  let showMobileHistory = $state(false);
  let selectedSessionId = $state<string | null>(null);

  let showDeleteSessionModal = $state(false);
  let deletingSessionId = $state<string | null>(null);
  let deletingSession = $state(false);
  let deleteSessionError = $state('');

  const defaultSuggestions = [
    "Setup my budget, salary RM4500",
    "Analyze my spending",
    "Help me save 20% of my income",
    "Tips to reduce my expenses"
  ];

  function formatAmount(amount: number): string {
    return 'RM ' + amount.toLocaleString();
  }

  onMount(async () => {
    await Promise.all([
      loadSuggestions(),
      loadChatHistory()
    ]);

    const overspentContext = sessionStorage.getItem('overspentContext');
    if (overspentContext) {
      sessionStorage.removeItem('overspentContext');
      try {
        const overspent = JSON.parse(overspentContext);
        const question = `I'm over budget in ${overspent.length} category${overspent.length > 1 ? 's' : ''}: ${overspent.map((o: any) => `${o.category} (over by ${formatAmount(o.over)})`).join(', ')}. What should I do?`;
        input = question;
        setTimeout(() => sendMessage(), 500);
      } catch (e) {
        console.error('Failed to parse overspent context:', e);
      }
    }
  });

  async function loadSuggestions() {
    isLoadingSuggestions = true;
    try {
      const response = await fetch('/api/ai-chat?type=suggestions', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        suggestions = data.suggestions || defaultSuggestions;
      } else {
        suggestions = defaultSuggestions;
      }
    } catch (err) {
      suggestions = defaultSuggestions;
    } finally {
      isLoadingSuggestions = false;
    }
  }

  async function loadChatHistory() {
    isLoadingSessions = true;
    try {
      const response = await fetch('/api/ai-chat?type=sessions', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.sessions && Array.isArray(data.sessions)) {
          chatSessions = data.sessions.map((s: any) => ({
            sessionId: s.sessionId,
            title: s.title,
            summary: s.summary,
            lastMessageAt: new Date(s.lastMessageAt),
            messageCount: s.messageCount || 0,
            topics: s.topics || [],
            sentiment: s.sentiment
          }));
        }
      }
    } finally {
      isLoadingSessions = false;
    }
  }

  async function loadSessionMessages(idToLoad: string) {
    try {
      const response = await fetch(`/api/ai-chat?type=messages&sessionId=${idToLoad}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.messages && Array.isArray(data.messages)) {
          const loadedMessages = data.messages.reverse().map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.createdAt),
            budgetActions: m.metadata?.budgetActions
          }));
          messages = loadedMessages;
          sessionId = idToLoad;
          selectedSessionId = idToLoad;
          setTimeout(scrollToBottom, 100);
        }
      }
    } catch (err) {
      console.error('Load session error:', err);
    }
  }

  function startNewChat() {
    messages = [{
      id: '1',
      role: 'assistant',
      content: "Hi! I'm **MonKrac** 🤖\n\nYour expert Financial Coach & Budget Advisor specializing in Malaysian personal finance.\n\nI have a **memory** and I **learn** from our conversations! The more we talk, the better I can help you.\n\nI can help you with:\n• **Setup your budget** - Tell me your salary and I'll create a personalized budget plan\n• **Analyze spending** - I'll review all your transactions and give smart tips\n• **Savings strategies** - Build emergency funds and achieve your financial goals\n• **Debt management** - Get advice on managing loans, credit cards, and PTPTN\n\nTry saying: \"Setup my budget, salary RM4500\" or \"Analyze my spending\"",
      timestamp: new Date()
    }];
    sessionId = crypto.randomUUID();
    selectedSessionId = null;
    pendingActions = null;
    learnedInfo = null;
  }

  function scrollToBottom() {
    const container = document.querySelector('[data-chat-container]');
    if (container) {
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }, 50);
    }
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    messages = [...messages, userMessage];
    const userInput = input;
    input = '';
    isLoading = true;
    learnedInfo = null;
    tick().then(scrollToBottom);

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: userInput, sessionId })
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message || "I'm not sure how to respond to that.",
        timestamp: new Date(),
        budgetActions: data.budgetActions
      };

      messages = [...messages, assistantMessage];
      tick().then(scrollToBottom);

      if (data.sessionId) {
        sessionId = data.sessionId;
        selectedSessionId = data.sessionId;
      }

      if (data.learnedProfile && Object.keys(data.learnedProfile).length > 0) {
        const learned = data.learnedProfile;
        const learnedBits: string[] = [];
        if (learned.monthlyIncome) learnedBits.push(`income: RM${learned.monthlyIncome}`);
        if (learned.spendingPersonality) learnedBits.push(`style: ${learned.spendingPersonality}`);
        if (learned.primaryGoal) learnedBits.push(`goal: ${learned.primaryGoal}`);
        if (learnedBits.length > 0) learnedInfo = `🧠 Learned: ${learnedBits.join(', ')}`;
      }

      if (data.budgetActions && data.budgetActions.length > 0) {
        pendingActions = data.budgetActions;
      }
    } catch (err) {
      messages = [...messages, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting right now.",
        timestamp: new Date()
      }];
    } finally {
      isLoading = false;
      loadSuggestions();
      loadChatHistory();
    }
  }

  async function applyBudgets() {
    if (!pendingActions || applyingBudgets) return;
    applyingBudgets = true;
    try {
      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          budgets: pendingActions.map(a => ({
            categoryName: a.categoryName,
            amount: a.amount,
            period: a.period,
            month: a.month,
            year: a.year
          })),
          clearExisting: true
        })
      });
      const data = await response.json();
      if (data.success) {
        messages = [...messages, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `✅ **Budget Applied!**\n\n${data.budgets.length} budget(s) have been saved.`,
          timestamp: new Date()
        }];
        pendingActions = null;
      }
    } finally {
      applyingBudgets = false;
      tick().then(scrollToBottom);
    }
  }

  function cancelBudgets() {
    pendingActions = null;
    messages = [...messages, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: "No problem! Let me know if you want to adjust anything.",
      timestamp: new Date()
    }];
    tick().then(scrollToBottom);
  }

  function useSuggestion(suggestion: string) {
    input = suggestion;
    sendMessage();
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function formatSessionDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function initiateDeleteSession(sessionId: string) {
    deletingSessionId = sessionId;
    showDeleteSessionModal = true;
    deleteSessionError = '';
  }

  async function confirmDeleteSession() {
    if (!deletingSessionId) return;
    deletingSession = true;
    try {
      const response = await fetch(`/api/ai-chat?sessionId=${deletingSessionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        chatSessions = chatSessions.filter(s => s.sessionId !== deletingSessionId);
        showDeleteSessionModal = false;
        if (selectedSessionId === deletingSessionId) startNewChat();
      }
    } finally {
      deletingSession = false;
    }
  }

  function cancelDeleteSession() {
    showDeleteSessionModal = false;
    deletingSessionId = null;
  }
</script>

<svelte:head>
  <title>MonKrac AI Coach - MoneyKracked</title>
</svelte:head>

<div class="flex flex-col lg:flex-row h-full w-full overflow-hidden bg-[var(--color-bg)]">
  <!-- Left Sidebar (History) -->
  <aside class="fixed inset-y-0 left-0 z-50 w-80 lg:static lg:flex flex-col border-r-4 border-black bg-[var(--color-surface)] transition-transform duration-300 {showMobileHistory ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} {showMobileHistory ? 'flex' : 'hidden lg:flex'}">
    <div class="p-6 border-b-4 border-black bg-[var(--color-surface-raised)] shadow-md">
      <h2 class="text-lg font-display text-[var(--color-primary)] mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined">history</span> HISTORY
      </h2>
      <PixelButton variant="primary" onclick={startNewChat} class="w-full text-xs py-3">
        <span class="material-symbols-outlined text-sm">add</span> NEW CHAT
      </PixelButton>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
      {#if isLoadingSessions}
        <div class="flex flex-col items-center justify-center h-40 gap-3">
           <div class="animate-spin h-8 w-8 border-4 border-[var(--color-primary)] border-t-transparent"></div>
           <p class="text-[10px] font-mono text-[var(--color-text-muted)] animate-pulse">DISK LOADING...</p>
        </div>
      {:else if chatSessions.length === 0}
        <div class="text-center py-10 px-4 border-2 border-dashed border-[var(--color-border)] opacity-30">
          <span class="material-symbols-outlined text-3xl text-[var(--color-text-muted)]">history_toggle_off</span>
          <p class="text-[10px] uppercase font-mono text-[var(--color-text-muted)] mt-2">No history</p>
        </div>
      {:else}
        {#each chatSessions as session}
          <div 
            role="button"
            tabindex="0"
            class="w-full text-left group relative bg-[var(--color-bg)] border-2 border-black p-3 hover:translate-x-1 hover:bg-[var(--color-surface-raised)] transition-all cursor-pointer {selectedSessionId === session.sessionId ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)] ring-inset shadow-[4px_4px_0px_0px_black]' : 'shadow-[2px_2px_0px_0px_black]'}"
            onclick={() => { loadSessionMessages(session.sessionId); showMobileHistory = false; }}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadSessionMessages(session.sessionId); } }}
          >
            <div class="flex justify-between items-start mb-1">
              <p class="text-xs font-bold text-[var(--color-text)] truncate pr-4">{session.title}</p>
              <span class="material-symbols-outlined text-xs text-[var(--color-primary)] mt-0.5">
                  {session.sentiment === 'positive' ? 'sentiment_satisfied' : 'chat_bubble'}
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-[9px] font-mono text-[var(--color-text-muted)] uppercase tracking-tighter">{formatSessionDate(session.lastMessageAt)}</span>
              <span class="text-[8px] font-mono text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity">RESUME ⏎</span>
            </div>
            
            <button
              onclick={(e) => { e.stopPropagation(); initiateDeleteSession(session.sessionId); }}
              class="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-[var(--color-danger)] text-white w-6 h-6 flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_black] hover:scale-110 transition-all z-10"
              aria-label="Delete chat session"
            >
              <span class="material-symbols-outlined text-xs">close</span>
            </button>
          </div>
        {/each}
      {/if}
    </div>
    
  </aside>

  <!-- Main Chat Column -->
  <div class="flex-1 flex flex-col min-w-0 h-full relative bg-[var(--color-bg)] border-black">
    <!-- App-like Inline Header -->
    <header class="h-20 flex items-center justify-between px-6 lg:px-10 border-b-4 border-black bg-[var(--color-surface-raised)] flex-shrink-0 z-20 shadow-lg">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
            <button class="lg:hidden h-10 w-10 border-2 border-black bg-[var(--color-surface)] flex items-center justify-center hover:bg-[var(--color-surface-raised)] transition-colors" onclick={toggleSidebar}>
              <span class="material-symbols-outlined">menu</span>
            </button>
            <button class="lg:hidden h-10 w-10 border-2 border-black bg-[var(--color-surface)] flex items-center justify-center hover:bg-[var(--color-surface-raised)] transition-colors" onclick={() => showMobileHistory = !showMobileHistory}>
              <span class="material-symbols-outlined">history</span>
            </button>
        </div>
        <div>
          <h2 class="text-lg md:text-xl font-display text-[var(--color-primary)]">MONKRAC AI <span class="text-[var(--color-text)]">COACH</span></h2>
          <p class="text-[9px] md:text-[10px] font-mono text-[var(--color-text-muted)] flex items-center gap-2">
            <span class="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            ACTIVE SESSION: {selectedSessionId ? selectedSessionId.slice(0, 8) : 'NEW'}
          </p>
        </div>
      </div>
      
      <div class="hidden md:flex items-center gap-4">
        <div class="px-3 py-1.5 border-2 border-black bg-black/20 text-[10px] font-mono text-[var(--color-text-muted)] cursor-help hover:text-[var(--color-text)] transition-colors">
          CTRL + ENTER TO SEND
        </div>
      </div>
    </header>

    <!-- Messages Area -->
    <div class="flex-1 overflow-y-auto p-4 lg:p-10 space-y-10 scroll-smooth custom-scrollbar" data-chat-container>
      <div class="w-full space-y-12">
        {#each messages as message}
          <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'} w-full group">
            <div class="flex flex-col {message.role === 'user' ? 'items-end' : 'items-start'} w-full">
              
              <!-- Avatar-Message Wrapper -->
              <div class="flex gap-4 {message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end">
                <!-- Avatar -->
                <div class="h-10 w-10 flex-shrink-0 flex items-center justify-center border-4 border-black shadow-[4px_4px_0px_0px_black] {message.role === 'user' ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-raised)]'} mb-2 overflow-hidden">
                  {#if message.role === 'user' && data.user?.image}
                    <img src={data.user.image} alt={data.user.name} class="w-full h-full object-cover" />
                  {:else}
                    <span class="material-symbols-outlined text-lg {message.role === 'user' ? 'text-black' : 'text-[var(--color-primary)]'}">
                      {message.role === 'user' ? 'person' : 'smart_toy'}
                    </span>
                  {/if}
                </div>

                <!-- Info (Timestamp/Role) -->
                <div class="flex flex-col {message.role === 'user' ? 'items-end' : 'items-start'} mb-2 flex-1 min-w-0">
                  <span class="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                    {message.role === 'user' ? 'YOU' : 'MONKRAC AI'}
                  </span>
                  
                  <!-- Content Bubble -->
                  <div class="w-full p-5 border-4 border-black shadow-[8px_8px_0px_0px_black] relative
                    {message.role === 'user' ? 'bg-[var(--color-primary)] text-black' : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]'}">
                    
                    <div class="text-base font-mono leading-relaxed whitespace-pre-wrap assistant-content">
                      {@html message.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold underline decoration-2">$1</strong>')
                        .replace(/• (.*)/g, '<span class="flex items-start gap-2 mt-2"><span class="pixel-bullet mt-2"></span><span>$1</span></span>')}
                    </div>
                    
                    <span class="absolute -bottom-4 {message.role === 'user' ? 'right-0' : 'left-0'} text-[8px] font-mono text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-[var(--color-bg)] px-1 border border-black/10">
                      SENT AT {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/each}

        {#if isLoading}
          <div class="flex justify-start w-full animate-in fade-in slide-in-from-left-4">
            <div class="flex gap-4 items-end">
              <div class="h-10 w-10 flex-shrink-0 flex items-center justify-center border-4 border-black shadow-[4px_4px_0px_0px_black] bg-[var(--color-surface-raised)] mb-2">
                <span class="material-symbols-outlined text-lg animate-pulse text-[var(--color-primary)]">smart_toy</span>
              </div>
              <div class="flex flex-col items-start mb-2">
                <span class="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1">MONKRAC IS ANALYSING...</span>
                <div class="bg-[var(--color-surface-raised)] p-5 border-4 border-black shadow-[8px_8px_0px_0px_black]">
                  <div class="flex gap-2">
                    <div class="h-3 w-3 bg-[var(--color-primary)] animate-[bounce_0.6s_infinite]"></div>
                    <div class="h-3 w-3 bg-[var(--color-primary)] animate-[bounce_0.6s_infinite_0.1s]"></div>
                    <div class="h-3 w-3 bg-[var(--color-primary)] animate-[bounce_0.6s_infinite_0.2s]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Budget Plan Ready Notification (Moved Inline to avoid overlap) -->
        {#if pendingActions && pendingActions.length > 0}
          <div class="w-full bg-[var(--color-surface-raised)] border-4 border-black shadow-[8px_8px_0px_0px_black] p-6 lg:p-10 animate-in slide-in-from-bottom-8">
            <div class="flex items-start justify-between mb-6">
              <div>
                <h3 class="text-lg font-display text-[var(--color-primary)] uppercase">PROPOSED BUDGET PLAN</h3>
                <p class="text-[10px] font-mono text-[var(--color-text-muted)] mt-1">Review and apply to your account</p>
              </div>
              <span class="material-symbols-outlined text-3xl animate-bounce text-[var(--color-primary)]">account_balance_wallet</span>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
              {#each pendingActions as action}
                <div class="bg-black/20 border-2 border-black p-4 hover:translate-y-[-2px] transition-transform">
                  <p class="text-[8px] text-[var(--color-text-muted)] font-mono uppercase tracking-tighter mb-1">{action.categoryName}</p>
                  <p class="text-base font-bold text-[var(--color-primary)] font-mono">{formatAmount(action.amount)}</p>
                </div>
              {/each}
            </div>
            
            <div class="flex flex-col sm:flex-row gap-4">
              <PixelButton variant="primary" onclick={applyBudgets} loading={applyingBudgets} class="flex-1 h-12 text-sm font-bold">
                APPLY ALL CHANGES
              </PixelButton>
              <PixelButton variant="ghost" onclick={cancelBudgets} disabled={applyingBudgets} class="flex-1 sm:flex-none h-12 px-6 text-sm">
                DISMISS
              </PixelButton>
            </div>
          </div>
        {/if}

        <!-- Learned Context -->
        {#if learnedInfo}
          <div class="inline-flex items-center gap-3 px-4 py-2 bg-[var(--color-primary)] border-4 border-black shadow-[4px_4px_0px_0px_black]">
            <span class="material-symbols-outlined text-sm text-black">psychology</span>
            <p class="text-[10px] text-black font-bold uppercase tracking-tight">{learnedInfo}</p>
          </div>
        {/if}

      </div>
    </div>

    <!-- Persistent Input Area -->
    <footer class="p-6 lg:p-10 bg-[var(--color-surface)] border-t-4 border-black z-20 flex-shrink-0">
      <div class="w-full">
        <form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="flex gap-5">
          <div class="relative flex-1">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-primary)] material-symbols-outlined font-bold">
              chevron_right
            </span>
            <input 
              type="text" 
              bind:value={input}
              placeholder="ASK MONKRAC ANYTHING..."
              disabled={isLoading}
              class="w-full bg-black border-4 border-black px-12 py-5 text-base font-mono text-[var(--color-text)] shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.5)] focus:ring-4 focus:ring-[var(--color-primary)]/20 outline-none placeholder:text-[var(--color-text-muted)]/30"
            />
            <div class="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none opacity-30 hidden md:flex">
              <span class="text-[10px] font-mono border border-white/20 px-1">ENTER</span>
              <span class="text-[10px] font-mono">⏎</span>
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            class="h-[72px] w-[72px] bg-[var(--color-primary)] border-4 border-black shadow-[4px_4px_0px_0px_black] flex items-center justify-center hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_black] disabled:bg-gray-700 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none transition-all group"
          >
             <span class="material-symbols-outlined text-black font-bold group-hover:scale-110 transition-transform">send</span>
          </button>
        </form>
        
        <p class="text-[8px] font-mono text-[var(--color-text-muted)] mt-4 uppercase text-center opacity-50 tracking-[3px]">
          POWERED BY MONKRAC INTELLIGENCE ENGINE V2.0.4
        </p>
      </div>
    </footer>
  </div>
  
  <!-- Mobile History Backdrop -->
  {#if showMobileHistory}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" 
      onclick={() => showMobileHistory = false}
    ></div>
  {/if}
</div>

<!-- Modal Background -->
{#if showDeleteSessionModal}
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in">
        <div class="max-w-sm w-full bg-[var(--color-bg)] border-4 border-black shadow-[16px_16px_0px_0px_var(--color-danger)] p-8">
            <h3 class="text-lg font-display text-[var(--color-danger)] mb-4 uppercase">WIPE CONVERSATION?</h3>
            <p class="text-sm text-[var(--color-text)] font-mono uppercase mb-8 leading-relaxed">
                This action is permanent. All context from this chat will be lost to the void.
            </p>
            <div class="flex gap-4">
                <PixelButton onclick={cancelDeleteSession} class="flex-1 py-4 text-xs">CANCEL</PixelButton>
                <PixelButton variant="danger" onclick={confirmDeleteSession} loading={deletingSession} class="flex-1 py-4 text-xs font-bold">WIPE DATA</PixelButton>
            </div>
        </div>
    </div>
{/if}

<style>
    .assistant-content :global(.pixel-bullet) {
        flex-shrink: 0;
        width: 10px;
        height: 10px;
        background: var(--color-primary);
        box-shadow: 2px 2px 0px 0px black;
        margin-top: 4px;
    }
    
    .assistant-content :global(strong) {
        color: var(--color-primary);
    }
    
    :global([data-theme="light"]) .assistant-content :global(strong) {
        color: #166534;
    }

    .custom-scrollbar::-webkit-scrollbar {
        width: 12px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: var(--color-bg);
        border-left: 2px solid rgba(0,0,0,0.1);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: var(--color-surface-raised);
        border: 2px solid var(--color-border);
    }
</style>
