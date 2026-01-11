export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          dark: 'var(--primary-dark)'
        },
        secondary: 'var(--secondary)',
        accent: 'var(--accent)',
        bg: 'var(--bg-color)',
        surface: {
          DEFAULT: 'var(--surface-color)',
          raised: 'var(--surface-raised-color)'
        },
        text: {
          DEFAULT: 'var(--text-color)',
          muted: 'var(--text-muted)'
        },
        border: 'var(--border-color)',
        shadow: 'var(--shadow-color)',
        
        // Semantic
        success: '#4ade80',
        warning: '#fbbf24',
        danger: '#f87171',
        info: '#60a5fa'
      },
      fontFamily: {
        display: ['var(--font-display)', 'cursive'],
        body: ['var(--font-body)', 'monospace'],
        mono: ['var(--font-body)', 'monospace'],
        ui: ['var(--font-ui)', 'sans-serif']
      },
      spacing: {
        depth: '4px'
      }
    }
  },
  plugins: []
};
