<script lang="ts">
  import { Header } from '$lib/components/layout';
  import { Card, Button, Input } from '$lib/components/ui';
  import { authClient } from '$lib/auth-client';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  
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
  
  // Use $derived for values from props to maintain reactivity
  const userEmail = $derived(data.user?.email || '');
  
  let name = $state('');
  let profileImage = $state<string | null>(null);
  let imagePreview = $state<string | null>(null);
  let uploadInProgress = $state(false);
  let showImageMenu = $state(false);

  $effect.pre(() => {
    name = data.user?.name || '';
    profileImage = data.user?.image || null;
    imagePreview = data.user?.image || null;
  });
  let currency = $state('MYR');
  let theme = $state('dark');
  let notifications = $state(true);
  let githubLinking = $state(false);
  // GitHub status - fetched directly from API, not from SvelteKit data
  let githubLinked = $state(false);
  let githubLoading = $state(true);
  let linkError = $state('');
  let linkSuccess = $state('');
  
  // Fetch GitHub status from API on mount and after navigation
  async function fetchGitHubStatus() {
    githubLoading = true;
    try {
      const response = await fetch('/api/github-status', {
        credentials: 'include'
      });
      const result = await response.json();
      githubLinked = result.linked || false;
      console.log('[Settings] GitHub status fetched:', result);
    } catch (err) {
      console.error('[Settings] Failed to fetch GitHub status:', err);
      githubLinked = false;
    } finally {
      githubLoading = false;
    }
  }
  
  // Fetch user preferences from API
  async function fetchPreferences() {
    try {
      const response = await fetch('/api/preferences', {
        credentials: 'include'
      });
      const result = await response.json();
      if (result.preferences) {
        currency = result.preferences.currency || 'MYR';
        theme = result.preferences.theme || 'dark';
        notifications = result.preferences.notifications ?? true;
        console.log('[Settings] Preferences loaded:', result.preferences);
      }
    } catch (err) {
      console.error('[Settings] Failed to load preferences:', err);
    }
  }
  
  // Save preferences to API
  async function savePreferences() {
    try {
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currency, theme, notifications })
      });
      console.log('[Settings] Preferences saved');
    } catch (err) {
      console.error('[Settings] Failed to save preferences:', err);
    }
  }

  // Fetch on mount
  onMount(() => {
    fetchGitHubStatus();
    fetchPreferences();
    fetchTwoFactorStatus();
  });
  
  // Auto-save when preferences change
  $effect(() => {
    // Track changes to save
    const _ = currency + theme + notifications.toString();
    // Only save if not the initial load
    if (typeof window !== 'undefined') {
      savePreferences();
    }
  });
  
  // Check URL params for link result
  $effect(() => {
    const success = $page.url.searchParams.get('success');
    const error = $page.url.searchParams.get('error');
    const message = $page.url.searchParams.get('message');
    
    if (success === 'linked') {
      linkSuccess = 'GitHub account linked successfully!';
      githubLinked = true;
      goto('/settings', { replaceState: true });
    } else if (success === 'already_linked') {
      linkSuccess = 'GitHub account is already linked.';
      githubLinked = true;
      goto('/settings', { replaceState: true });
    } else if (error === 'link_failed') {
      linkError = message ? decodeURIComponent(message) : 'Failed to link GitHub account';
      goto('/settings', { replaceState: true });
    }
  });
  
  const currencies = [
    { code: 'MYR', name: 'Malaysian Ringgit' },
    { code: 'SGD', name: 'Singapore Dollar' },
    { code: 'USD', name: 'US Dollar' }
  ];
  
  async function linkGitHub() {
    console.log("Initiating GitHub link via unified endpoint...");
    githubLinking = true;
    linkError = '';
    
    // Redirect to unified GitHub OAuth endpoint in link mode
    window.location.href = '/api/github-oauth?mode=link&callbackURL=' + encodeURIComponent(window.location.pathname);
  }
  
  async function unlinkGitHub() {
    console.log("Initiating GitHub unlink...");
    linkError = '';
    linkSuccess = '';

    try {
      const response = await fetch('/api/github-unlink', {
        method: 'DELETE',
        credentials: 'include'
      });

      const result = await response.json();

      if (result.success) {
        linkSuccess = 'GitHub account unlinked successfully!';
        githubLinked = false;
        console.log('[Settings] GitHub unlinked successfully');
      } else {
        throw new Error(result.error || 'Failed to unlink');
      }
    } catch (err: any) {
      console.error('[Settings] Unlink failed:', err);
      linkError = err.message || 'Failed to unlink GitHub account';
    }
  }

  // Profile image upload functions
  let fileInput: HTMLInputElement;

  function triggerFileInput() {
    fileInput.click();
  }

  // Resize image on client-side before upload to reduce file size
  function resizeImage(file: File, maxWidth: number = 200, maxHeight: number = 200, quality: number = 0.8): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        // Calculate new dimensions (square crop)
        const size = Math.min(maxWidth, maxHeight);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Calculate crop to center
        const sourceSize = Math.min(img.width, img.height);
        const sourceX = (img.width - sourceSize) / 2;
        const sourceY = (img.height - sourceSize) / 2;

        // Draw image cropped to square
        ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, 'image/jpeg', quality);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
      return;
    }

    // Validate file size (max 5MB for initial file - we'll resize it)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File too large. Maximum size is 5MB.');
      return;
    }

    uploadInProgress = true;

    try {
      // Resize image to 200x200 with 80% quality
      const resizedBlob = await resizeImage(file, 200, 200, 0.8);
      console.log('[Settings] Original size:', file.size, 'Resized size:', resizedBlob.size);

      // Create preview from resized blob
      const previewReader = new FileReader();
      previewReader.onload = (e) => {
        imagePreview = e.target?.result as string;
      };
      previewReader.readAsDataURL(resizedBlob);

      // Upload resized image
      const formData = new FormData();
      formData.append('image', resizedBlob, 'profile.jpg');

      const response = await fetch('/api/user/image', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        profileImage = result.image;
        // Show success feedback
        linkSuccess = 'Profile image updated successfully!';
        setTimeout(() => linkSuccess = '', 3000);
      } else {
        throw new Error(result.details || result.error || 'Failed to upload image');
      }
    } catch (err: any) {
      console.error('[Settings] Image upload failed:', err);
      alert(err.message || 'Failed to upload image. Please try again.');
      // Reset preview on error
      imagePreview = profileImage;
    } finally {
      uploadInProgress = false;
      // Reset file input
      target.value = '';
    }
  }

  async function removeImage() {
    if (!profileImage) return;

    if (!confirm('Are you sure you want to remove your profile image?')) {
      return;
    }

    uploadInProgress = true;
    try {
      const response = await fetch('/api/user/image', {
        method: 'DELETE',
        credentials: 'include'
      });

      const result = await response.json();

      if (result.success) {
        profileImage = null;
        imagePreview = null;
        linkSuccess = 'Profile image removed successfully!';
        setTimeout(() => linkSuccess = '', 3000);
      } else {
        throw new Error(result.error || 'Failed to remove image');
      }
    } catch (err: any) {
      console.error('[Settings] Image removal failed:', err);
      alert(err.message || 'Failed to remove image. Please try again.');
    } finally {
      uploadInProgress = false;
      showImageMenu = false;
    }
  }

  function toggleImageMenu() {
    showImageMenu = !showImageMenu;
  }

  function closeImageMenu() {
    showImageMenu = false;
  }

  // ===== Two-Factor Authentication (2FA) =====
  let twoFactorEnabled = $state(false);
  let twoFactorLoading = $state(true);
  let showTwoFactorSetup = $state(false);
  let showDisableTwoFactor = $state(false);

  // Setup state
  let qrCodeUrl = $state('');
  let setupSecret = $state('');
  let verifyCode = $state('');
  let setupStep = $state<'scan' | 'verify' | 'backup'>('scan');
  let backupCodes = $state<string[]>([]);

  // Disable state
  let disableCode = $state('');
  let disableMethod = $state<'totp' | 'backup'>('totp');

  // Fetch 2FA status
  async function fetchTwoFactorStatus() {
    twoFactorLoading = true;
    try {
      const response = await fetch('/api/2fa', {
        credentials: 'include'
      });
      const result = await response.json();
      twoFactorEnabled = result.enabled || false;
      console.log('[Settings] 2FA status:', twoFactorEnabled);
    } catch (err) {
      console.error('[Settings] Failed to fetch 2FA status:', err);
    } finally {
      twoFactorLoading = false;
    }
  }

  // Setup 2FA - Generate QR code
  async function setupTwoFactor() {
    try {
      const response = await fetch('/api/2fa', {
        method: 'POST',
        credentials: 'include'
      });
      const result = await response.json();

      if (result.qrCode) {
        qrCodeUrl = result.qrCode;
        setupSecret = result.secret;
        setupStep = 'scan';
        showTwoFactorSetup = true;
      } else {
        throw new Error(result.error || 'Failed to setup 2FA');
      }
    } catch (err: any) {
      console.error('[Settings] 2FA setup error:', err);
      alert(err.message || 'Failed to setup 2FA');
    }
  }

  // Verify and enable 2FA
  async function enableTwoFactor() {
    if (!verifyCode || verifyCode.length !== 6) {
      alert('Please enter a valid 6-digit code');
      return;
    }

    try {
      const response = await fetch('/api/2fa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: verifyCode })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to enable 2FA');
      }

      if (result.success) {
        backupCodes = result.backupCodes || [];
        setupStep = 'backup';
        twoFactorEnabled = true;
      }
    } catch (err: any) {
      console.error('[Settings] 2FA enable error:', err);
      alert(err.message || 'Failed to enable 2FA');
    }
  }

  // Cancel 2FA setup
  function cancelTwoFactorSetup() {
    showTwoFactorSetup = false;
    qrCodeUrl = '';
    setupSecret = '';
    verifyCode = '';
    setupStep = 'scan';
    backupCodes = [];
  }

  // Show disable 2FA dialog
  function openDisableTwoFactor() {
    showDisableTwoFactor = true;
    disableCode = '';
    disableMethod = 'totp';
  }

  // Disable 2FA
  async function disableTwoFactor() {
    if (!disableCode) {
      alert('Please enter a code');
      return;
    }

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
        twoFactorEnabled = false;
        showDisableTwoFactor = false;
        disableCode = '';
        linkSuccess = '2FA disabled successfully';
        setTimeout(() => linkSuccess = '', 3000);
      } else {
        throw new Error(result.error || 'Failed to disable 2FA');
      }
    } catch (err: any) {
      console.error('[Settings] 2FA disable error:', err);
      alert(err.message || 'Failed to disable 2FA');
    }
  }

  // Copy backup code
  function copyBackupCode(code: string) {
    navigator.clipboard.writeText(code);
    linkSuccess = 'Code copied!';
    setTimeout(() => linkSuccess = '', 2000);
  }
</script>

<svelte:head>
  <title>Settings - MoneyKracked</title>
</svelte:head>

<div class="min-h-screen bg-bg-dark p-4 md:p-6 lg:p-8">
  <Header title="Settings" subtitle="Manage your account and preferences" />
  
  <div class="max-w-4xl mx-auto space-y-6 mt-6">
    <!-- Profile Section -->
    <Card padding="lg">
      <h3 class="text-lg font-bold text-white mb-6">Profile</h3>
      
      <div class="flex items-center gap-6 mb-6">
        <!-- Profile Photo -->
        <div class="relative">
          <div class="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center text-2xl font-bold text-white overflow-hidden">
            {#if imagePreview}
              <img src={imagePreview} alt={data.user?.name || 'User'} class="w-full h-full object-cover" />
            {:else}
              {(data.user?.name || 'U').charAt(0).toUpperCase()}
            {/if}
          </div>
          <button
            onclick={toggleImageMenu}
            class="absolute bottom-0 right-0 p-1.5 bg-surface-dark rounded-full border border-border-dark hover:bg-bg-dark transition-colors"
            disabled={uploadInProgress}
          >
            {#if uploadInProgress}
              <span class="material-symbols-outlined text-sm text-primary animate-spin">sync</span>
            {:else}
              <span class="material-symbols-outlined text-sm text-text-secondary">edit</span>
            {/if}
          </button>

          <!-- Image Action Menu -->
          {#if showImageMenu}
            <div class="absolute top-full left-0 mt-2 bg-surface-dark border border-border-dark rounded-lg shadow-xl overflow-hidden min-w-[140px] z-[60]">
              <button
                onclick={triggerFileInput}
                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-white hover:bg-border-dark transition-colors text-left"
              >
                <span class="material-symbols-outlined text-lg">upload</span>
                <span>Upload Photo</span>
              </button>
              {#if profileImage}
                <button
                  onclick={removeImage}
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors text-left"
                >
                  <span class="material-symbols-outlined text-lg">delete</span>
                  <span>Remove Photo</span>
                </button>
              {/if}
            </div>
          {/if}

          <!-- Hidden file input -->
          <input
            type="file"
            bind:this={fileInput}
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onchange={handleFileSelect}
            class="hidden"
          />
        </div>
        
        <div>
          <h4 class="text-lg font-semibold text-white">{data.user?.name || 'User'}</h4>
          <p class="text-text-muted">{userEmail}</p>
        </div>
      </div>
      
      <div class="grid gap-4 md:grid-cols-2">
        <Input label="Full Name" bind:value={name} placeholder="Enter your name" />
        <Input label="Email" value={userEmail} disabled />
      </div>
      
      <div class="mt-4 flex justify-end">
        <Button>Save Changes</Button>
      </div>
    </Card>
    
    <!-- Connected Accounts -->
    <Card padding="lg">
      <h3 class="text-lg font-bold text-white mb-6">Connected Accounts</h3>
      
      {#if linkError}
        <div class="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
          {linkError}
        </div>
      {/if}
      
      {#if linkSuccess}
        <div class="mb-4 p-3 bg-success/10 border border-success/30 rounded-lg text-success text-sm">
          {linkSuccess}
        </div>
      {/if}
      
      <div class="flex items-center justify-between p-4 bg-bg-dark rounded-lg border border-border-dark">
        <div class="flex items-center gap-4">
          <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <div>
            <p class="font-medium text-white">GitHub</p>
            <p class="text-xs text-text-muted">
              {#if githubLoading}
                Checking...
              {:else if githubLinked}
                Connected
              {:else}
                Not connected
              {/if}
            </p>
          </div>
        </div>
        
        {#if githubLoading}
          <Button variant="secondary" size="sm" disabled>
            Loading...
          </Button>
        {:else if githubLinked}
          <Button variant="danger" size="sm" onclick={unlinkGitHub}>
            Unlink
          </Button>
        {:else}
          <Button variant="secondary" size="sm" loading={githubLinking} onclick={linkGitHub}>
            Link Account
          </Button>
        {/if}
      </div>
    </Card>
    
    <!-- Preferences -->
    <Card padding="lg">
      <h3 class="text-lg font-bold text-white mb-6">Preferences</h3>
      
      <div class="space-y-6">
        <!-- Currency -->
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-white">Default Currency</p>
            <p class="text-sm text-text-muted">Used for all transactions</p>
          </div>
          <select 
            bind:value={currency}
            class="bg-bg-dark border border-border-dark rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {#each currencies as curr}
              <option value={curr.code}>{curr.code} - {curr.name}</option>
            {/each}
          </select>
        </div>
        
        <!-- Theme -->
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-white">Theme</p>
            <p class="text-sm text-text-muted">Choose your preferred theme</p>
          </div>
          <select 
            bind:value={theme}
            class="bg-bg-dark border border-border-dark rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </div>
        
        <!-- Notifications -->
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-white">Notifications</p>
            <p class="text-sm text-text-muted">Receive budget alerts and tips</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" bind:checked={notifications} class="sr-only peer" />
            <div class="w-11 h-6 bg-bg-dark peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all border border-border-dark peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>
    </Card>

    <!-- Two-Factor Authentication -->
    <Card padding="lg">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h3 class="text-lg font-bold text-white">Two-Factor Authentication</h3>
          <p class="text-sm text-text-muted">Add an extra layer of security to your account</p>
        </div>
        {#if twoFactorLoading}
          <div class="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
        {:else if twoFactorEnabled}
          <span class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/20 text-success text-sm font-medium">
            <span class="material-symbols-outlined text-sm">check_circle</span>
            Enabled
          </span>
        {:else}
          <span class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-text-muted/20 text-text-muted text-sm font-medium">
            <span class="material-symbols-outlined text-sm">cancel</span>
            Disabled
          </span>
        {/if}
      </div>

      {#if twoFactorEnabled}
        <div class="p-4 bg-bg-dark rounded-lg border border-border-dark">
          <p class="text-sm text-text-muted mb-4">
            Your account is protected with two-factor authentication. You'll need to enter a code from your authenticator app when logging in.
          </p>
          <div class="flex gap-3">
            <Button variant="danger" onclick={openDisableTwoFactor}>Disable 2FA</Button>
          </div>
        </div>
      {:else}
        <div class="p-4 bg-bg-dark rounded-lg border border-border-dark">
          <div class="flex items-start gap-4">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary flex-shrink-0">
              <span class="material-symbols-outlined">security</span>
            </div>
            <div class="flex-1">
              <h4 class="font-medium text-white mb-1">Protect your account</h4>
              <p class="text-sm text-text-muted mb-4">
                Use an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator to generate verification codes.
              </p>
              <Button onclick={setupTwoFactor}>Enable Two-Factor Authentication</Button>
            </div>
          </div>
        </div>
      {/if}
    </Card>

    <!-- Danger Zone -->
    <Card padding="lg">
      <h3 class="text-lg font-bold text-danger mb-4">Danger Zone</h3>
      <p class="text-text-muted mb-4">Once you delete your account, there is no going back. Please be certain.</p>
      <Button variant="danger">Delete Account</Button>
    </Card>
  </div>
</div>

<!-- Click outside to close image menu -->
{#if showImageMenu}
  <div
    class="fixed inset-0 z-0"
    role="button"
    tabindex="-1"
    aria-label="Close menu"
    onclick={closeImageMenu}
    onkeydown={(e) => e.key === 'Escape' && closeImageMenu()}
  ></div>
{/if}

<!-- 2FA Setup Modal -->
{#if showTwoFactorSetup}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
    <div class="bg-surface-dark rounded-2xl border border-border-dark shadow-2xl max-w-md w-full overflow-hidden">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-bold text-white">Setup Two-Factor Authentication</h3>
          <button onclick={cancelTwoFactorSetup} class="text-text-muted hover:text-white">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        {#if setupStep === 'scan'}
          <!-- Step 1: Scan QR Code -->
          <div class="space-y-4">
            <p class="text-sm text-text-muted">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>

            {#if qrCodeUrl}
              <div class="flex justify-center p-4 bg-white rounded-lg">
                <img src={qrCodeUrl} alt="QR Code" class="w-48 h-48" />
              </div>
            {/if}

            <div class="p-3 bg-bg-dark rounded-lg border border-border-dark">
              <p class="text-xs text-text-muted mb-1">Or enter this code manually:</p>
              <div class="flex items-center justify-between">
                <code class="text-sm font-mono text-white">{setupSecret}</code>
                <button onclick={() => copyBackupCode(setupSecret)} class="text-primary hover:text-primary-hover text-sm">
                  Copy
                </button>
              </div>
            </div>

            <Button class="w-full" onclick={() => setupStep = 'verify'}>
              Continue
            </Button>
          </div>

        {:else if setupStep === 'verify'}
          <!-- Step 2: Verify Code -->
          <div class="space-y-4">
            <p class="text-sm text-text-muted">
              Enter the 6-digit code from your authenticator app to verify the setup.
            </p>

            <div>
              <label for="verify-code" class="block text-sm font-medium text-white mb-2">Verification Code</label>
              <input
                id="verify-code"
                type="text"
                inputmode="numeric"
                pattern="[0-9]{6}"
                maxlength="6"
                bind:value={verifyCode}
                placeholder="000000"
                class="w-full bg-bg-dark border border-border-dark rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div class="flex gap-3">
              <Button variant="secondary" class="flex-1" onclick={cancelTwoFactorSetup}>
                Cancel
              </Button>
              <Button class="flex-1" onclick={enableTwoFactor}>
                Verify & Enable
              </Button>
            </div>
          </div>

        {:else if setupStep === 'backup'}
          <!-- Step 3: Backup Codes -->
          <div class="space-y-4">
            <div class="p-4 bg-warning/10 border border-warning/30 rounded-lg">
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-warning text-xl">warning</span>
                <div>
                  <p class="font-medium text-white">Save these backup codes!</p>
                  <p class="text-sm text-text-muted">
                    Store these codes safely. You can use them to access your account if you lose your authenticator device.
                  </p>
                </div>
              </div>
            </div>

            <div class="p-4 bg-bg-dark rounded-lg border border-border-dark space-y-2 max-h-48 overflow-y-auto">
              {#each backupCodes as code}
                <div class="flex items-center justify-between p-2 bg-surface-dark rounded">
                  <code class="font-mono text-white">{code}</code>
                  <button onclick={() => copyBackupCode(code)} class="text-primary hover:text-primary-hover">
                    <span class="material-symbols-outlined text-lg">content_copy</span>
                  </button>
                </div>
              {/each}
            </div>

            <div class="flex gap-3">
              <Button variant="secondary" onclick={cancelTwoFactorSetup} class="flex-1">
                I've Saved My Codes
              </Button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Disable 2FA Modal -->
{#if showDisableTwoFactor}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
    <div class="bg-surface-dark rounded-2xl border border-border-dark shadow-2xl max-w-md w-full">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-bold text-white">Disable Two-Factor Authentication</h3>
          <button onclick={() => showDisableTwoFactor = false} class="text-text-muted hover:text-white">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="space-y-4">
          <p class="text-sm text-text-muted">
            To disable 2FA, enter a verification code from your authenticator app or use one of your backup codes.
          </p>

          <!-- Method Toggle -->
          <div class="flex gap-2 p-1 bg-bg-dark rounded-lg">
            <button
              class="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors {disableMethod === 'totp' ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}"
              onclick={() => disableMethod = 'totp'}
            >
              Authenticator Code
            </button>
            <button
              class="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors {disableMethod === 'backup' ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}"
              onclick={() => disableMethod = 'backup'}
            >
              Backup Code
            </button>
          </div>

          <div>
            <label for="disable-code" class="block text-sm font-medium text-white mb-2">
              {disableMethod === 'totp' ? 'Enter 6-digit code' : 'Enter backup code'}
            </label>
            <input
              id="disable-code"
              type="text"
              bind:value={disableCode}
              placeholder={disableMethod === 'totp' ? '000000' : 'XXXXXXXX'}
              class="w-full bg-bg-dark border border-border-dark rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div class="flex gap-3">
            <Button variant="secondary" class="flex-1" onclick={() => showDisableTwoFactor = false}>
              Cancel
            </Button>
            <Button variant="danger" class="flex-1" onclick={disableTwoFactor}>
              Disable 2FA
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
