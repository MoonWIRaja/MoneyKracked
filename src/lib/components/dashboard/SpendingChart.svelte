<script lang="ts">
  import { IsometricCard, PixelButton } from '$lib/components/ui';
  
  interface CategoryData {
    name: string;
    value: number;
    percentage: number;
    color: string;
    formattedValue?: string;
    categoryId?: string;
  }
  
  interface Props {
    data: CategoryData[];
    total: string;
    remainingBudget?: { value: number; formattedValue: string; percentage: number };
    title?: string;
    subtitle?: string;
    onColorChange?: (categoryName: string, color: string) => void;
  }
  
  let {
    data,
    total,
    remainingBudget,
    title = 'Spending by Category',
    subtitle = 'Breakdown for this month',
    onColorChange
  }: Props = $props();
  
  // Color picker state
  let showColorPicker = $state(false);
  let colorPickerCategory = $state<string>('');
  let selectedColor = $state('#21c462');
  
  // Preset colors
  const presetColors = [
    '#21c462', // Green (primary)
    '#3b82f6', // Blue
    '#f59e0b', // Orange
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f97316', // Deep orange
    '#6366f1', // Indigo
    '#84cc16', // Lime
    '#14b8a6'  // Teal
  ];
  
  function openColorPicker(categoryName: string, currentColor: string) {
    colorPickerCategory = categoryName;
    selectedColor = currentColor;
    showColorPicker = true;
  }
  
  function closeColorPicker() {
    showColorPicker = false;
    colorPickerCategory = '';
  }
  
  function applyColor() {
    if (onColorChange && colorPickerCategory) {
      onColorChange(colorPickerCategory, selectedColor);
    }
    closeColorPicker();
  }
  
  // Calculate stroke dash array for each segment
  function calculateSegments(categories: CategoryData[], remaining?: { percentage: number }) {
    let offset = 0;
    const segments = [];
    
    // Add remaining budget segment first (green)
    if (remaining && remaining.percentage > 0) {
      segments.push({
        percentage: remaining.percentage,
        offset: offset,
        color: 'var(--color-primary)'
      });
      offset += remaining.percentage;
    }
    
    // Add category segments
    for (const cat of categories) {
      if (cat.percentage > 0) {
        segments.push({
          percentage: cat.percentage,
          offset: offset,
          color: cat.color
        });
        offset += cat.percentage;
      }
    }
    
    return segments;
  }
  
  const segments = $derived(calculateSegments(data, remainingBudget));
</script>

<IsometricCard title="Budget Breakdown" class="flex flex-col h-full">
  <div class="mb-6">
    <h3 class="text-sm font-bold text-[var(--color-text)] font-display uppercase">{title}</h3>
    <p class="text-xs text-[var(--color-text-muted)] font-mono">{subtitle}</p>
  </div>
  
  <div class="flex flex-col items-center gap-8 lg:flex-row lg:justify-around">
    <!-- Donut Chart -->
    <div class="relative h-48 w-48 flex-shrink-0">
      <svg class="h-full w-full -rotate-90 drop-shadow-md" viewBox="0 0 36 36">
        <!-- Background Circle -->
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke="var(--color-surface-raised)"
          stroke-width="5"
        />
        
        <!-- Category Segments -->
        {#each segments as segment}
          <circle
            cx="18"
            cy="18"
            r="15.9155"
            fill="none"
            stroke={segment.color}
            stroke-width="5"
            stroke-dasharray="{segment.percentage} {100 - segment.percentage}"
            stroke-dashoffset={-segment.offset}
            class="transition-all duration-500"
          />
        {/each}
        
        <!-- Inner Pixel Hole (Optional decoration) -->
        <circle
            cx="18"
            cy="18"
            r="10"
            fill="var(--color-surface)"
            stroke="var(--color-border)"
            stroke-width="0.5"
        />
      </svg>
      
      <!-- Center Text -->
      <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span class="text-[0.6rem] font-mono text-[var(--color-text-muted)] uppercase">Total</span>
        <span class="text-sm font-bold text-[var(--color-text)] font-mono bg-[var(--color-surface)] px-1 border border-[var(--color-border)]">{total}</span>
      </div>
    </div>
    
    <!-- Legend Table -->
    <div class="flex-1 w-full max-w-md">
      <table class="w-full border-collapse">
        <thead>
          <tr class="text-xs text-[var(--color-text-muted)] font-mono border-b-2 border-[var(--color-border)]">
            <th class="text-left pb-2 font-normal">Category</th>
            <th class="text-right pb-2 font-normal">Amount</th>
            <th class="text-right pb-2 font-normal w-16">%</th>
          </tr>
        </thead>
        <tbody class="font-mono text-sm">
          <!-- Remaining Budget row -->
          {#if remainingBudget}
            <tr class="bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <td class="py-2 pl-2 border-l-2 border-[var(--color-primary)]">
                <div class="flex items-center gap-2">
                  <div class="h-3 w-3 border border-black bg-[var(--color-primary)]"></div>
                  <span>Remaining</span>
                </div>
              </td>
              <td class="py-2 text-right">{remainingBudget.formattedValue}</td>
              <td class="py-2 pr-2 text-right">{remainingBudget.percentage.toFixed(1)}%</td>
            </tr>
          {/if}
          
          <!-- Category rows -->
          {#each data as category, i}
            <tr class="border-b border-[var(--color-surface-raised)] hover:bg-[var(--color-surface-raised)]">
              <td class="py-2 pl-2">
                <div class="flex items-center gap-2">
                  <!-- Clickable color dot -->
                  <button
                    onclick={() => openColorPicker(category.name, category.color)}
                    class="h-3 w-3 border border-black cursor-pointer hover:scale-125 transition-transform"
                    style="background-color: {category.color}"
                    title="Change Color"
                  ></button>
                  <span class="text-[var(--color-text)] truncate max-w-[100px]">{category.name}</span>
                </div>
              </td>
              <td class="py-2 text-right text-[var(--color-text)]">{category.formattedValue || '-'}</td>
              <td class="py-2 pr-2 text-right text-[var(--color-text-muted)]">{category.percentage.toFixed(1)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</IsometricCard>

<!-- Color Picker Modal -->
{#if showColorPicker}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <!-- Pixel Art Modal -->
    <div class="bg-[var(--color-surface)] border-2 border-[var(--color-border)] shadow-[8px_8px_0px_0px_var(--color-shadow)] w-full max-w-xs">
      <div class="p-3 border-b-2 border-[var(--color-border)] bg-[var(--color-surface-raised)] flex justify-between items-center">
        <h3 class="text-sm font-bold text-[var(--color-text)] font-display uppercase">Select Color</h3>
        <button onclick={closeColorPicker} class="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
            <span class="material-symbols-outlined font-bold">close</span>
        </button>
      </div>
      
      <div class="p-4">
        <p class="text-xs text-[var(--color-text-muted)] font-mono mb-3 uppercase">Target: {colorPickerCategory}</p>
        
        <!-- Color Grid -->
        <div class="grid grid-cols-6 gap-2 mb-4">
          {#each presetColors as color}
            <button
              onclick={() => selectedColor = color}
              class="h-8 w-8 border-2 transition-transform hover:scale-110 {selectedColor === color ? 'border-[var(--color-text)]' : 'border-transparent'}"
              style="background-color: {color}; box-shadow: 2px 2px 0 0 rgba(0,0,0,0.2);"
              aria-label="Select color {color}"
            ></button>
          {/each}
        </div>
        
        <!-- Custom Color Input -->
        <div class="flex items-center gap-2 bg-[var(--color-bg)] p-2 border-2 border-[var(--color-border)] shadow-inner">
          <input
            type="color"
            bind:value={selectedColor}
            class="h-6 w-6 cursor-pointer border-none bg-transparent p-0"
          />
          <input
            type="text"
            bind:value={selectedColor}
            class="flex-1 bg-transparent border-none text-[var(--color-text)] font-mono text-sm uppercase focus:outline-none"
            maxlength="7"
          />
        </div>
      </div>
      
      <div class="p-3 border-t-2 border-[var(--color-border)] flex justify-end gap-2 bg-[var(--color-surface-raised)]">
        <PixelButton variant="ghost" onclick={closeColorPicker}>Cancel</PixelButton>
        <PixelButton variant="primary" onclick={applyColor}>Apply</PixelButton>
      </div>
    </div>
  </div>
{/if}
