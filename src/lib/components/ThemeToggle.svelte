<script lang="ts">
  import { onMount } from 'svelte';

  let theme = $state('dark');

  onMount(() => {
    if (localStorage.theme === 'light' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: light)').matches)) {
      theme = 'light';
    } else {
      theme = 'dark';
    }
  });

  function toggleTheme() {
    if (theme === 'light') {
      theme = 'dark';
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      theme = 'light';
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  }
</script>

<button
  onclick={toggleTheme}
  class="iso-btn"
  aria-label="Toggle Theme"
>
  <span class="material-symbols-outlined">
    {theme === 'light' ? 'light_mode' : 'dark_mode'}
  </span>
  <span class="hidden sm:inline font-mono">
    {theme === 'light' ? 'LGT' : 'DRK'}
  </span>
</button>

<style>
  /* Extra pixel art adjustments if needed */
  button {
    min-width: 48px;
    height: 48px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
