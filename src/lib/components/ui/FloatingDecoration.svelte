<script lang="ts">
  interface Props {
    color?: string;
    size?: string;
    top?: string;
    left?: string;
    delay?: string;
    rotate?: string;
  }
  
  let { 
    color = 'var(--color-primary)', 
    size = '40px', 
    top = '10%', 
    left = '10%', 
    delay = '0s',
    rotate = '0deg'
  }: Props = $props();
</script>

<div class="fixed pointer-events-none z-0" style="top: {top}; left: {left};">
  <div class="pixel-block-3d" style="--size: {size}; --color: {color}; --delay: {delay}; transform: rotate({rotate});">
    <div class="side front"></div>
    <div class="side top"></div>
    <div class="side right"></div>
  </div>
</div>

<style>
  .pixel-block-3d {
    width: var(--size);
    height: var(--size);
    position: relative;
    transform-style: preserve-3d;
    animation: float 6s ease-in-out infinite;
    animation-delay: var(--delay);
  }

  .side {
    position: absolute;
    width: 100%;
    height: 100%;
    border: 3px solid black;
  }

  .front {
    background: var(--color);
    transform: translateZ(calc(var(--size) / 2));
  }

  .top {
    background: white;
    opacity: 0.5;
    height: calc(var(--size) / 2);
    transform: rotateX(90deg) translateZ(calc(var(--size) / 4));
    top: 0;
  }

  .right {
    background: black;
    opacity: 0.2;
    width: calc(var(--size) / 2);
    transform: rotateY(90deg) translateZ(calc(var(--size) / 4));
    right: 0;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
    50% { transform: translateY(-20px) rotate(10deg) scale(1.1); }
  }
</style>
