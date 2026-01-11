<script lang="ts">
  import { IsometricCard, PixelButton, Input } from '$lib/components/ui';
  import { authClient } from '$lib/auth-client';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { updateCurrency, subscribeToCurrency } from '$lib/stores/currency-store';
  import { setAppTheme } from '$lib/stores/app-store.svelte';

  interface Props {
    data: {
      user: {
        name: string;
        email: string;
        image?: string | null;
      } | null;
    };
  }

  let { data }: Props = $props();

  const userEmail = $derived(data.user?.email || '');

  import { untrack } from 'svelte';

  let name = $state(untrack(() => data.user?.name || ''));
  let profileImage = $state<string | null>(untrack(() => data.user?.image || null));
  let imagePreview = $state<string | null>(untrack(() => data.user?.image || null));
  let uploadInProgress = $state(false);
  let showImageMenu = $state(false);

  let showRemoveImageConfirm = $state(false);
  let removingImage = $state(false);
  let removeImageError = $state('');

  // No longer need effect.pre for initialization as we use untrack in $state
  
  let currency = $state('MYR');
  let theme = $state('dark');
  let preferencesInitialized = $state(false);

  let githubLinked = $state(false);
  let githubLoading = $state(true);
  let linkError = $state('');
  let linkSuccess = $state('');
  
  async function fetchGitHubStatus() {
    githubLoading = true;
    try {
      const response = await fetch('/api/github-status', { credentials: 'include' });
      const result = await response.json();
      githubLinked = result.linked || false;
    } catch (err) {
      githubLinked = false;
    } finally {
      githubLoading = false;
    }
  }
  
  async function fetchPreferences() {
    try {
      const response = await fetch('/api/preferences', { credentials: 'include' });
      const result = await response.json();
      if (result.preferences) {
        // Use untrack to prevent triggering the auto-save effect during initial fetch
        untrack(() => {
            currency = result.preferences.currency || 'MYR';
            theme = result.preferences.theme || 'dark';
            preferencesInitialized = true;
        });
      }
    } catch (err) {
      console.error('[Settings] Failed to load preferences:', err);
    }
  }
  
  async function savePreferences() {
    if (!preferencesInitialized) return;

    try {
      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currency, theme })
      });
      const result = await response.json();
      if (result.success) {
        await updateCurrency(currency as any);
        if (result.preferences.currency !== currency) {
          linkSuccess = `Currency converted!`;
          setTimeout(() => linkSuccess = '', 3000);
        }
      }
    } catch (err) {
      console.error('[Settings] Failed to save preferences:', err);
    }
  }

  onMount(() => {
    fetchGitHubStatus();
    fetchPreferences();
    fetchTwoFactorStatus();
  });

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    // Watch these values
    const _ = currency + theme;
    
    if (typeof window !== 'undefined' && preferencesInitialized) {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => { 
        untrack(() => savePreferences()); 
      }, 800);
    }
  });

  // Apply theme instantly
  $effect(() => {
    if (preferencesInitialized) {
      setAppTheme(theme);
    }
  });
  
  $effect(() => {
    const success = $page.url.searchParams.get('success');
    const error = $page.url.searchParams.get('error');
    const message = $page.url.searchParams.get('message');
    
    if (success === 'linked' || success === 'already_linked') {
      linkSuccess = 'GitHub linked successfully!';
      githubLinked = true;
      goto('/settings', { replaceState: true });
    } else if (error === 'link_failed') {
      linkError = message ? decodeURIComponent(message) : 'Failed to link GitHub';
      goto('/settings', { replaceState: true });
    }
  });
  
  const currencies_list = [
    { code: 'MYR', name: 'Malaysian Ringgit' },
    { code: 'SGD', name: 'Singapore Dollar' },
    { code: 'USD', name: 'US Dollar' }
  ];
  
  async function linkGitHub() {
    window.location.href = '/api/github-oauth?mode=link&callbackURL=' + encodeURIComponent(window.location.pathname);
  }
  
  async function unlinkGitHub() {
    try {
      const response = await fetch('/api/github-unlink', { method: 'DELETE', credentials: 'include' });
      const result = await response.json();
      if (result.success) {
        linkSuccess = 'GitHub unlinked successfully!';
        githubLinked = false;
      }
    } catch (err: any) {
      linkError = err.message || 'Failed to unlink GitHub';
    }
  }

  let fileInput: HTMLInputElement;
  function triggerFileInput() { fileInput.click(); }

  function resizeImage(file: File, maxWidth: number = 200, maxHeight: number = 200, quality: number = 0.8): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target?.result as string; };
      img.onload = () => {
        const size = Math.min(maxWidth, maxHeight);
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas error')); return; }
        const sourceSize = Math.min(img.width, img.height);
        const sourceX = (img.width - sourceSize) / 2;
        const sourceY = (img.height - sourceSize) / 2;
        ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Blob error')); }, 'image/jpeg', quality);
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    uploadInProgress = true;
    try {
      const resizedBlob = await resizeImage(file, 200, 200, 0.8);
      const formData = new FormData();
      formData.append('image', resizedBlob, 'profile.jpg');
      const response = await fetch('/api/user/image', { method: 'POST', credentials: 'include', body: formData });
      const result = await response.json();
      if (result.success) {
        profileImage = result.image;
        imagePreview = result.image;
        linkSuccess = 'Image updated!';
        setTimeout(() => linkSuccess = '', 3000);
      }
    } catch (err: any) {
      alert('Upload failed');
    } finally {
      uploadInProgress = false;
    }
  }

  async function confirmRemoveImage() {
    removingImage = true;
    try {
      const response = await fetch('/api/user/image', { method: 'DELETE', credentials: 'include' });
      const result = await response.json();
      if (result.success) {
        profileImage = null; imagePreview = null;
        linkSuccess = 'Image removed!';
        setTimeout(() => linkSuccess = '', 3000);
        showRemoveImageConfirm = false;
      }
    } finally {
      removingImage = false;
    }
  }

  function toggleImageMenu() { showImageMenu = !showImageMenu; }
  function closeImageMenu() { showImageMenu = false; }

  // 2FA Logic
  let twoFactorEnabled = $state(false);
  let twoFactorLoading = $state(true);
  let showTwoFactorSetup = $state(false);
  let showDisableTwoFactor = $state(false);
  let qrCodeUrl = $state('');
  let setupSecret = $state('');
  let verifyCode = $state('');
  let setupStep = $state<'scan' | 'verify' | 'backup'>('scan');
  let backupCodes = $state<string[]>([]);
  let disableCode = $state('');
  let disableMethod = $state<'totp' | 'backup'>('totp');

  async function fetchTwoFactorStatus() {
    twoFactorLoading = true;
    try {
      const response = await fetch('/api/2fa', { credentials: 'include' });
      const result = await response.json();
      twoFactorEnabled = result.enabled || false;
    } finally {
      twoFactorLoading = false;
    }
  }

  async function setupTwoFactor() {
    try {
      const response = await fetch('/api/2fa', { method: 'POST', credentials: 'include' });
      const result = await response.json();
      if (result.qrCode) {
        qrCodeUrl = result.qrCode; setupSecret = result.secret;
        setupStep = 'scan'; showTwoFactorSetup = true;
      }
    } catch (err: any) { alert('2FA Setup Error'); }
  }

  async function enableTwoFactor() {
    try {
      const response = await fetch('/api/2fa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: verifyCode })
      });
      const result = await response.json();
      if (result.success) {
        backupCodes = result.backupCodes || [];
        setupStep = 'backup'; twoFactorEnabled = true;
      }
    } catch (err: any) { alert('Verify Error'); }
  }

  async function disableTwoFactor() {
    try {
      const response = await fetch('/api/2fa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          totpCode: disableMethod === 'totp' ? disableCode : undefined,
          backupCode: disableMethod === 'backup' ? disableCode : undefined
        })
      });
      const result = await response.json();
      if (result.success) {
        twoFactorEnabled = false; showDisableTwoFactor = false;
        linkSuccess = '2FA disabled'; setTimeout(() => linkSuccess = '', 3000);
      }
    } catch (err: any) { alert('Disable Error'); }
  }

  let showDeleteAccount = $state(false);
  let deleteStep = $state<'confirm' | 'password' | 'final'>('confirm');
  let deletePassword = $state('');
  let deleteConfirmed = $state(false);
  let deleteLoading = $state(false);
  let deleteError = $state('');

  function closeDeleteAccount() { 
    showDeleteAccount = false; 
    deleteStep = 'confirm'; 
    deletePassword = ''; 
    deleteError = ''; 
    deleteConfirmed = false; 
  }

  async function proceedToDelete() {
    if (deleteStep === 'confirm') deleteStep = 'password';
    else if (deleteStep === 'password') {
      if (!deletePassword) { deleteError = 'PASSWORD_REQUIRED'; return; }
      deleteStep = 'final';
    }
  }

  async function confirmDeleteAccount() {
    deleteLoading = true;
    try {
      const response = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: deletePassword })
      });
      const result = await response.json();
      if (result.success) window.location.href = '/?accountDeleted=true';
    } catch (err: any) { deleteError = err.message; }
    finally { deleteLoading = false; }
  }
</script>

<svelte:head>
  <title>Settings - MoneyKracked</title>
</svelte:head>

<div class="flex h-[calc(100%+2rem)] lg:h-[calc(100%+4rem)] w-[calc(100%+4rem)] overflow-hidden bg-[var(--color-bg)] -m-4 lg:-m-8 border-black">
  <!-- Main Settings Column -->
  <div class="flex-1 flex flex-col min-w-0 h-full relative bg-[var(--color-bg)]">
    <!-- App-like Inline Header -->
    <header class="h-20 flex items-center justify-between px-6 lg:px-10 border-b-4 border-black bg-[var(--color-surface-raised)] flex-shrink-0 z-20 shadow-lg">
      <div class="flex items-center gap-4">
        <div>
          <h2 class="text-xl font-display text-[var(--color-primary)]">SYSTEM <span class="text-[var(--color-text)]">SETTINGS</span></h2>
          <p class="text-[10px] font-mono text-[var(--color-text-muted)] flex items-center gap-2 uppercase">
            <span class="flex h-2 w-2 rounded-full bg-[var(--color-primary)] animate-pulse"></span>
            Configuration & Profile
          </p>
        </div>
      </div>
    </header>

    <!-- Scrollable Content Area -->
    <div class="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 scroll-smooth custom-scrollbar">
    <!-- Profile & Notifications -->
    {#if linkError || linkSuccess}
        <div class="px-4 py-3 border-4 border-black font-mono text-xs uppercase
            {linkError ? 'bg-[var(--color-danger)] text-black' : 'bg-[var(--color-primary)] text-black'}">
            {linkError || linkSuccess}
        </div>
    {/if}

    <IsometricCard title="Your Profile">
        <div class="flex flex-col md:flex-row gap-8 items-center md:items-start p-2">
            <div class="relative">
                <div class="w-32 h-32 border-4 border-black bg-[var(--color-surface-raised)] flex items-center justify-center overflow-hidden shadow-[4px_4px_0px_0px_var(--color-shadow)]">
                    {#if imagePreview}
                        <img src={imagePreview} alt="User" class="w-full h-full object-cover pixelated" />
                    {:else}
                        <span class="text-4xl font-display text-[var(--color-text-muted)]">{(data.user?.name || '?').charAt(0)}</span>
                    {/if}
                    {#if uploadInProgress}
                        <div class="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div class="animate-spin h-8 w-8 border-4 border-[var(--color-primary)] border-t-transparent"></div>
                        </div>
                    {/if}
                </div>
                <button 
                    onclick={toggleImageMenu}
                    class="absolute -bottom-2 -right-2 w-10 h-10 bg-[var(--color-primary)] border-4 border-black shadow-[2px_2px_0px_0px_var(--color-shadow)] flex items-center justify-center active:translate-y-0.5 active:shadow-none transition-all"
                >
                    <span class="material-symbols-outlined text-black">photo_camera</span>
                </button>

                {#if showImageMenu}
                    <div class="absolute top-full right-0 mt-4 w-48 bg-[var(--color-surface)] border-4 border-black shadow-[4px_4px_0px_0px_var(--color-shadow)] z-10 overflow-hidden">
                        <button onclick={triggerFileInput} class="w-full p-3 text-left font-mono text-xs uppercase hover:bg-[var(--color-surface-raised)] flex items-center gap-2">
                             <span class="material-symbols-outlined text-sm">upload</span> Upload New
                        </button>
                        {#if profileImage}
                            <button onclick={() => { showRemoveImageConfirm = true; showImageMenu = false; }} class="w-full p-3 text-left font-mono text-xs uppercase text-[var(--color-danger)] hover:bg-[var(--color-surface-raised)] flex items-center gap-2">
                                <span class="material-symbols-outlined text-sm">delete</span> Delete Photo
                            </button>
                        {/if}
                    </div>
                {/if}
                <input type="file" bind:this={fileInput} onchange={handleFileSelect} class="hidden" accept="image/*" />
            </div>

            <div class="flex-1 w-full space-y-4">
                <Input label="Display Name" bind:value={name} placeholder="Enter your name" />
                <Input label="Email Address" value={userEmail} disabled />
                <div class="flex justify-end pt-2">
                   <PixelButton variant="primary">Save Changes</PixelButton>
                </div>
            </div>
        </div>
    </IsometricCard>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Preferences -->
        <IsometricCard title="Preferences">
            <div class="space-y-6 p-2">
                <div class="space-y-2">
                    <label for="currency-select" class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest">Default Currency</label>
                    <div class="relative">
                        <select id="currency-select" bind:value={currency} class="iso-input appearance-none uppercase text-sm">
                            {#each currencies_list as curr}
                                <option value={curr.code}>{curr.code} - {curr.name}</option>
                            {/each}
                        </select>
                        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">expand_more</span>
                    </div>
                </div>

                <div class="space-y-2">
                    <label for="theme-select" class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest">Visual Theme</label>
                    <div class="relative">
                        <select id="theme-select" bind:value={theme} class="iso-input appearance-none uppercase text-sm">
                            <option value="dark">Dark Theme</option>
                            <option value="light">Light Theme</option>
                            <option value="system">Follow System</option>
                        </select>
                        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">expand_more</span>
                    </div>
                </div>
            </div>
        </IsometricCard>

        <!-- Connectivity -->
        <IsometricCard title="Connections">
            <div class="p-2 space-y-6">
                <div class="flex items-center justify-between p-3 bg-[var(--color-bg)] border-2 border-black">
                    <div class="flex items-center gap-3">
                        <svg class="w-8 h-8 text-[var(--color-text)]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        <div>
                            <p class="text-[10px] font-mono uppercase tracking-widest">GitHub</p>
                            <p class="text-[9px] font-mono uppercase text-[var(--color-text-muted)]">
                                {githubLoading ? 'Syncing...' : githubLinked ? 'Connected' : 'Not Linked'}
                            </p>
                        </div>
                    </div>
                    {#if githubLinked}
                        <PixelButton variant="primary" onclick={unlinkGitHub} class="text-[9px]">Unlink</PixelButton>
                    {:else}
                        <PixelButton variant="primary" onclick={linkGitHub} class="text-[9px]">Connect</PixelButton>
                    {/if}
                </div>

                <div class="pt-4 border-t-2 border-[var(--color-surface-raised)] space-y-4">
                    <div class="flex items-center justify-between">
                         <div>
                            <p class="text-[10px] font-mono uppercase tracking-widest">Two-Factor Auth</p>
                            <p class="text-[9px] font-mono uppercase text-[var(--color-text-muted)] mt-1">Extra Security Layer</p>
                        </div>
                        <div class="px-2 py-1 bg-black text-[10px] font-mono uppercase {twoFactorEnabled ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}">
                            {twoFactorEnabled ? 'ENABLED' : 'DISABLED'}
                        </div>
                    </div>
                    
                    {#if twoFactorEnabled}
                         <PixelButton variant="danger" class="w-full text-xs" onclick={() => showDisableTwoFactor = true}>
                            Disable 2FA
                         </PixelButton>
                    {:else}
                         <PixelButton variant="primary" class="w-full text-xs" onclick={setupTwoFactor}>
                            Enable 2FA
                         </PixelButton>
                    {/if}
                </div>
            </div>
        </IsometricCard>
    </div>

    <!-- Danger Zone -->
    <IsometricCard title="Danger Zone" class="!border-[var(--color-danger)] shadow-[var(--spacing-depth)_var(--spacing-depth)_0px_0px_var(--color-danger)]">
        <div class="p-2 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
                <p class="text-[10px] font-mono text-[var(--color-danger)] uppercase tracking-widest">Delete Account</p>
                <p class="text-[9px] font-mono text-[var(--color-text-muted)] uppercase mt-1">Erase all data permanently</p>
            </div>
            <PixelButton variant="danger" class="text-xs" onclick={() => showDeleteAccount = true}>
                Terminate Account
            </PixelButton>
        </div>
        </IsometricCard>
    </div>
  </div>

<!-- Modals -->
{#if showRemoveImageConfirm}
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <IsometricCard title="Delete Photo" class="max-w-xs w-full bg-[var(--color-bg)]">
            <p class="text-xs text-[var(--color-text)] font-mono uppercase text-center mb-6 leading-relaxed">
                Are you sure you want to remove your photo?
            </p>
            <div class="flex gap-3">
                <PixelButton onclick={() => showRemoveImageConfirm = false} class="flex-1 text-[10px]">Back</PixelButton>
                <PixelButton variant="danger" onclick={confirmRemoveImage} loading={removingImage} class="flex-1 text-[10px]">Remove</PixelButton>
            </div>
        </IsometricCard>
    </div>
{/if}

{#if showTwoFactorSetup}
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <IsometricCard title="Setup 2FA" class="max-w-md w-full bg-[var(--color-bg)]">
            {#if setupStep === 'scan'}
                <div class="space-y-4">
                    <p class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase text-center">Scan QR code with your auth app</p>
                    <div class="p-4 bg-white border-4 border-black shadow-[4px_4px_0px_0px_var(--color-shadow)] flex justify-center mx-auto">
                        <img src={qrCodeUrl} alt="QR" class="w-40 h-40 pixelated" />
                    </div>
                    <div class="p-3 bg-[var(--color-surface-raised)] border-2 border-black font-mono text-[10px] uppercase">
                        <p class="text-[var(--color-text-muted)] mb-1">Manual Key:</p>
                        <div class="flex justify-between items-center">
                            <span class="text-white font-bold">{setupSecret}</span>
                            <button onclick={() => navigator.clipboard.writeText(setupSecret)} class="text-[var(--color-primary)]">Copy</button>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <PixelButton variant="ghost" class="flex-1" onclick={() => showTwoFactorSetup = false}>Cancel</PixelButton>
                        <PixelButton variant="primary" class="flex-1" onclick={() => setupStep = 'verify'}>Next</PixelButton>
                    </div>
                </div>
            {:else if setupStep === 'verify'}
                <div class="space-y-4">
                    <p class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase text-center">Enter 6-digit code</p>
                    <input 
                        type="text" 
                        bind:value={verifyCode} 
                        placeholder="000000" 
                        class="iso-input text-center text-4xl tracking-widest font-mono" 
                        maxlength="6"
                    />
                    <div class="flex gap-2">
                        <PixelButton variant="ghost" onclick={() => showTwoFactorSetup = false}>Cancel</PixelButton>
                        <PixelButton onclick={() => setupStep = 'scan'} class="flex-1">Back</PixelButton>
                        <PixelButton variant="primary" onclick={enableTwoFactor} class="flex-1">Verify</PixelButton>
                    </div>
                </div>
            {:else}
                <div class="space-y-4">
                    <p class="text-[10px] font-mono text-[var(--color-warning)] uppercase text-center tracking-widest">Save Backup Codes</p>
                    <div class="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                        {#each backupCodes as code}
                            <div class="p-2 bg-[var(--color-surface-raised)] border-2 border-black flex justify-between items-center group">
                                <span class="font-mono text-xs">{code}</span>
                                <button onclick={() => navigator.clipboard.writeText(code)} class="text-[var(--color-primary)] opacity-0 group-hover:opacity-100">
                                    <span class="material-symbols-outlined text-sm">content_copy</span>
                                </button>
                            </div>
                        {/each}
                    </div>
                    <PixelButton variant="primary" class="w-full" onclick={() => showTwoFactorSetup = false}>Done</PixelButton>
                </div>
            {/if}
        </IsometricCard>
    </div>
{/if}

{#if showDisableTwoFactor}
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <IsometricCard title="Disable 2FA" class="max-w-xs w-full bg-[var(--color-bg)]">
            <div class="space-y-4">
                <p class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase text-center">Enter verification code</p>
                <div class="flex border-2 border-black p-1 bg-[var(--color-surface-raised)]">
                    <button class="flex-1 py-1 text-[9px] uppercase font-mono {disableMethod === 'totp' ? 'bg-[var(--color-primary)] text-black' : ''}" onclick={() => disableMethod = 'totp'}>App Code</button>
                    <button class="flex-1 py-1 text-[9px] uppercase font-mono {disableMethod === 'backup' ? 'bg-[var(--color-primary)] text-black' : ''}" onclick={() => disableMethod = 'backup'}>Backup Key</button>
                </div>
                <input type="text" bind:value={disableCode} placeholder="......" class="iso-input text-center font-mono" />
                <div class="flex gap-2">
                    <PixelButton onclick={() => showDisableTwoFactor = false} class="flex-1">Back</PixelButton>
                    <PixelButton variant="danger" onclick={disableTwoFactor} class="flex-1">Disable</PixelButton>
                </div>
            </div>
        </IsometricCard>
    </div>
{/if}

{#if showDeleteAccount}
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <IsometricCard title="Delete Account" class="max-w-md w-full !border-[var(--color-danger)]">
            <div class="space-y-4">
                {#if deleteStep === 'confirm'}
                    <p class="text-xs font-mono uppercase text-center text-[var(--color-danger)]">All data will be erased. Continue?</p>
                    <div class="flex gap-2">
                        <PixelButton class="flex-1" onclick={closeDeleteAccount}>Abort</PixelButton>
                        <PixelButton variant="danger" class="flex-1" onclick={() => deleteStep = 'password'}>Confirm</PixelButton>
                    </div>
                {:else if deleteStep === 'password'}
                    <p class="text-[10px] font-mono uppercase text-center">Verify your password</p>
                    <input type="password" bind:value={deletePassword} class="iso-input" />
                    {#if deleteError}<p class="text-[9px] text-[var(--color-danger)] font-mono uppercase text-center">{deleteError}</p>{/if}
                    <div class="flex gap-2">
                        <PixelButton class="flex-1" onclick={closeDeleteAccount}>Back</PixelButton>
                        <PixelButton variant="danger" class="flex-1" onclick={() => deleteStep = 'final'}>Next</PixelButton>
                    </div>
                {:else}
                    <div class="p-3 border-2 border-black bg-[var(--color-bg)] flex items-start gap-3">
                         <input id="delete-confirm-check" type="checkbox" bind:checked={deleteConfirmed} class="w-6 h-6 border-4 border-black text-[var(--color-danger)] bg-black" />
                         <label for="delete-confirm-check" class="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">I agree to delete all my data permanently.</label>
                    </div>
                    <div class="flex gap-2">
                        <PixelButton class="flex-1" onclick={closeDeleteAccount}>Abort</PixelButton>
                        <PixelButton variant="danger" class="flex-1" disabled={!deleteConfirmed} onclick={confirmDeleteAccount} loading={deleteLoading}>Delete Account</PixelButton>
                    </div>
                {/if}
            </div>
        </IsometricCard>
    </div>
{/if}
</div>

<style>
    .pixelated { image-rendering: pixelated; }
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
