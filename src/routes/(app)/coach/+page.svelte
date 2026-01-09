<script lang="ts">
  import { Header } from '$lib/components/layout';
  import { Card, Button } from '$lib/components/ui';
  import { onMount } from 'svelte';

  interface BudgetAction {
    action: 'create' | 'update' | 'delete';
    categoryName: string;
    amount: number;
    period: 'monthly' | 'weekly' | 'yearly';
  }

  interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    budgetActions?: BudgetAction[];
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

  // Default suggestions while loading
  const defaultSuggestions = [
    "Setup my budget, salary RM4500",
    "Analyze my spending",
    "Help me save 20% of my income",
    "Tips to reduce my expenses"
  ];

  // Load smart suggestions on mount
  onMount(async () => {
    await loadSuggestions();
  });

  async function loadSuggestions() {
    isLoadingSuggestions = true;
    try {
      const response = await fetch('/api/ai-chat?type=suggestions', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        suggestions = data.suggestions || defaultSuggestions;
      } else {
        suggestions = defaultSuggestions;
      }
    } catch (err) {
      console.error('Load suggestions error:', err);
      suggestions = defaultSuggestions;
    } finally {
      isLoadingSuggestions = false;
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

      // Update session ID for continuity
      if (data.sessionId) {
        sessionId = data.sessionId;
      }

      // Show what AI learned
      if (data.learnedProfile && Object.keys(data.learnedProfile).length > 0) {
        const learned = data.learnedProfile;
        const learnedBits: string[] = [];
        if (learned.monthlyIncome) learnedBits.push(`income: RM${learned.monthlyIncome}`);
        if (learned.spendingPersonality) learnedBits.push(`spending style: ${learned.spendingPersonality}`);
        if (learned.primaryGoal) learnedBits.push(`goal: ${learned.primaryGoal}`);
        if (learnedBits.length > 0) {
          learnedInfo = `🧠 Learned: ${learnedBits.join(', ')}`;
        }
      }

      // If there are budget actions, show pending
      if (data.budgetActions && data.budgetActions.length > 0) {
        pendingActions = data.budgetActions;
      }

    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting right now. Please try again.",
        timestamp: new Date()
      };
      messages = [...messages, errorMessage];
    } finally {
      isLoading = false;
      // Refresh suggestions after each message (they update based on popularity)
      loadSuggestions();
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
            period: a.period
          }))
        })
      });

      const data = await response.json();

      if (data.success) {
        const confirmMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `✅ **Budget Applied!**\n\n${data.budgets.length} budget(s) have been saved. You can view them in the Budget page.\n\nIs there anything else you'd like to adjust?`,
          timestamp: new Date()
        };
        messages = [...messages, confirmMessage];
        pendingActions = null;
      } else {
        throw new Error(data.error);
      }

    } catch (err: any) {
      console.error('Apply budget error:', err);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ Failed to apply budgets: ${err.message}`,
        timestamp: new Date()
      };
      messages = [...messages, errorMessage];
    } finally {
      applyingBudgets = false;
    }
  }

  function cancelBudgets() {
    pendingActions = null;
    const cancelMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: "No problem! Let me know if you want to adjust anything or try a different approach.",
      timestamp: new Date()
    };
    messages = [...messages, cancelMessage];
  }

  function useSuggestion(suggestion: string) {
    input = suggestion;
    sendMessage();
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function formatAmount(amount: number): string {
    return 'RM ' + amount.toLocaleString();
  }
</script>

<svelte:head>
  <title>MonKrac AI Coach - MoneyKracked</title>
</svelte:head>

<!-- Page Header -->
<Header
  title="MonKrac AI Coach"
  subtitle="Your expert financial advisor powered by AI"
/>

<div class="flex flex-col h-[calc(100vh-220px)] lg:h-[calc(100vh-180px)]">
  <!-- Chat Messages -->
  <Card padding="none" class="flex-1 overflow-hidden flex flex-col">
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      {#each messages as message}
        <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
          <div class="flex items-start gap-3 max-w-[85%]">
            {#if message.role === 'assistant'}
              <div class="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-lg">smart_toy</span>
              </div>
            {/if}
            
            <div class="{message.role === 'user' ? 'bg-primary text-white' : 'bg-border-dark text-white'} rounded-2xl px-4 py-3">
              <p class="whitespace-pre-line text-sm">{@html message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>
              <p class="text-xs mt-2 {message.role === 'user' ? 'text-white/60' : 'text-text-muted'}">
                {formatTime(message.timestamp)}
              </p>
            </div>
            
            {#if message.role === 'user'}
              <div class="flex-shrink-0 h-8 w-8 rounded-full bg-surface-dark flex items-center justify-center text-text-secondary">
                <span class="material-symbols-outlined text-lg">person</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
      
      {#if isLoading}
        <div class="flex justify-start">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <span class="material-symbols-outlined text-lg">smart_toy</span>
            </div>
            <div class="bg-border-dark rounded-2xl px-4 py-3">
              <div class="flex items-center gap-1">
                <span class="h-2 w-2 rounded-full bg-text-muted animate-bounce"></span>
                <span class="h-2 w-2 rounded-full bg-text-muted animate-bounce" style="animation-delay: 0.1s"></span>
                <span class="h-2 w-2 rounded-full bg-text-muted animate-bounce" style="animation-delay: 0.2s"></span>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Pending Budget Actions -->
    {#if pendingActions && pendingActions.length > 0}
      <div class="p-4 border-t border-border-dark bg-surface-dark/50">
        <p class="text-sm font-medium text-white mb-3">📋 Suggested Budget Plan:</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {#each pendingActions as action}
            <div class="bg-bg-dark rounded-lg p-3 border border-border-dark">
              <p class="text-xs text-text-muted">{action.categoryName}</p>
              <p class="font-bold text-white">{formatAmount(action.amount)}</p>
              <p class="text-xs text-text-muted">/{action.period}</p>
            </div>
          {/each}
        </div>
        <div class="flex gap-2">
          <Button onclick={applyBudgets} loading={applyingBudgets}>
            {#snippet icon()}
              <span class="material-symbols-outlined text-lg">check</span>
            {/snippet}
            Apply Budget
          </Button>
          <Button variant="secondary" onclick={cancelBudgets} disabled={applyingBudgets}>
            Cancel
          </Button>
        </div>
      </div>
    {/if}

    <!-- AI Learning Indicator -->
    {#if learnedInfo}
      <div class="px-4 py-2 bg-primary/10 border-t border-border-dark">
        <p class="text-xs text-primary flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">psychology</span>
          {learnedInfo}
        </p>
      </div>
    {/if}
    
    <!-- Suggestions -->
    {#if messages.length <= 1}
      <div class="p-4 border-t border-border-dark">
        <div class="flex items-center gap-2 mb-2">
          <p class="text-xs text-text-muted">
            {isLoadingSuggestions ? 'Loading suggestions...' : '🔥 Trending questions:'}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          {#each (isLoadingSuggestions ? defaultSuggestions : suggestions) as suggestion}
            <button
              onclick={() => useSuggestion(suggestion)}
              disabled={isLoadingSuggestions}
              class="px-3 py-1.5 text-sm rounded-full bg-bg-dark border border-border-dark text-text-secondary hover:text-white hover:border-primary transition-colors disabled:opacity-50"
            >
              {suggestion}
            </button>
          {/each}
        </div>
      </div>
    {/if}
    
    <!-- Input Area -->
    <div class="p-4 border-t border-border-dark">
      <form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="flex items-center gap-3">
        <input
          type="text"
          placeholder="Ask your AI coach..."
          bind:value={input}
          disabled={isLoading}
          class="flex-1 px-4 py-2.5 rounded-full bg-bg-dark border border-border-dark text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
        
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          class="flex-shrink-0 h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
        >
          <span class="material-symbols-outlined">send</span>
        </button>
      </form>
    </div>
  </Card>
</div>
