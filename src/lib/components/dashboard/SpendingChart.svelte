<script lang="ts">
  import { Card } from '$lib/components/ui';
  import { createEventDispatcher } from 'svelte';
  
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
        color: '#21c462'
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

<Card padding="lg" class="flex flex-col">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h3 class="text-lg font-bold text-white">{title}</h3>
      <p class="text-sm text-text-secondary">{subtitle}</p>
    </div>
  </div>
  
  <div class="flex flex-col items-center gap-8 lg:flex-row lg:justify-around">
    <!-- Donut Chart -->
    <div class="relative h-48 w-48 flex-shrink-0">
      <svg class="h-full w-full -rotate-90" viewBox="0 0 36 36">
        <!-- Background Circle -->
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          class="text-border-dark"
        />
        
        <!-- Category Segments -->
        {#each segments as segment}
          <circle
            cx="18"
            cy="18"
            r="15.9155"
            fill="none"
            stroke={segment.color}
            stroke-width="3"
            stroke-dasharray="{segment.percentage} {100 - segment.percentage}"
            stroke-dashoffset={-segment.offset}
            class="transition-all duration-500"
          />
        {/each}
      </svg>
      
      <!-- Center Text -->
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-xs font-medium text-text-muted">Total</span>
        <span class="text-lg font-bold text-white">{total}</span>
      </div>
    </div>
    
    <!-- Legend Table -->
    <div class="flex-1 w-full max-w-md">
      <table class="w-full">
        <thead>
          <tr class="text-xs text-text-muted border-b border-border-dark">
            <th class="text-left pb-2 font-medium">Category</th>
            <th class="text-right pb-2 font-medium">Amount</th>
            <th class="text-right pb-2 font-medium w-16">%</th>
          </tr>
        </thead>
        <tbody>
          <!-- Remaining Budget row (always first, highlighted) -->
          {#if remainingBudget}
            <tr class="bg-primary/10 font-semibold">
              <td class="py-2.5 px-2 rounded-l-lg">
                <div class="flex items-center gap-2">
                  <div class="h-3 w-3 rounded-full bg-primary"></div>
                  <span class="text-sm text-primary">Remaining</span>
                </div>
              </td>
              <td class="py-2.5 text-right text-sm text-primary">{remainingBudget.formattedValue}</td>
              <td class="py-2.5 px-2 text-right text-sm text-primary rounded-r-lg">{remainingBudget.percentage.toFixed(1)}%</td>
            </tr>
          {/if}
          
          <!-- Category rows -->
          {#each data as category, i}
            <tr class="{i % 2 === 0 ? '' : 'bg-border-dark/30'}">
              <td class="py-2 px-2 rounded-l-lg">
                <div class="flex items-center gap-2">
                  <!-- Clickable color dot -->
                  <button
                    onclick={() => openColorPicker(category.name, category.color)}
                    class="h-4 w-4 rounded-full border-2 border-white/20 hover:border-white/50 transition-colors cursor-pointer hover:scale-110"
                    style="background-color: {category.color}"
                    title="Click to change color"
                  ></button>
                  <span class="text-sm text-text-secondary">{category.name}</span>
                </div>
              </td>
              <td class="py-2 text-right text-sm text-white">{category.formattedValue || '-'}</td>
              <td class="py-2 px-2 text-right text-sm text-text-muted rounded-r-lg">{category.percentage.toFixed(1)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</Card>

<!-- Color Picker Modal -->
{#if showColorPicker}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="bg-surface-dark rounded-2xl border border-border-dark w-full max-w-xs mx-4 shadow-2xl">
      <div class="p-4 border-b border-border-dark">
        <h3 class="text-lg font-bold text-white">Choose Color</h3>
        <p class="text-sm text-text-muted">{colorPickerCategory}</p>
      </div>
      
      <div class="p-4">
        <!-- Color Grid -->
        <div class="grid grid-cols-6 gap-2 mb-4">
          {#each presetColors as color}
            <button
              onclick={() => selectedColor = color}
              class="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 {selectedColor === color ? 'border-white ring-2 ring-white/30' : 'border-transparent'}"
              style="background-color: {color}"
              aria-label="Select color {color}"
            ></button>
          {/each}
        </div>
        
        <!-- Custom Color Input -->
        <div class="flex items-center gap-2">
          <label for="custom-color-picker" class="text-sm text-text-muted">Custom:</label>
          <input
            id="custom-color-picker"
            type="color"
            bind:value={selectedColor}
            class="h-8 w-12 rounded cursor-pointer bg-transparent border-0"
          />
          <input
            type="text"
            bind:value={selectedColor}
            class="flex-1 px-2 py-1 text-sm rounded bg-bg-dark border border-border-dark text-white uppercase"
            maxlength="7"
          />
        </div>
      </div>
      
      <div class="p-4 border-t border-border-dark flex justify-end gap-2">
        <button
          onclick={closeColorPicker}
          class="px-4 py-2 text-sm rounded-lg text-text-secondary hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={applyColor}
          class="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  </div>
{/if}
