<script lang="ts">
  type Props = {
    size?: number;
    withWordmark?: boolean;
  };
  let { size = 36, withWordmark = false }: Props = $props();
</script>

<span class="logo" style="--logo-size:{size}px">
  <svg
    class="mark"
    viewBox="0 0 64 64"
    width={size}
    height={size}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="logo-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff5d6" />
        <stop offset="45%" stop-color="#f3c969" />
        <stop offset="100%" stop-color="#b6862f" />
      </linearGradient>
    </defs>
    <rect
      x="8"
      y="10"
      width="48"
      height="44"
      rx="3"
      fill="none"
      stroke="url(#logo-gold)"
      stroke-width="3.2"
    />
    <rect
      x="12"
      y="14"
      width="40"
      height="36"
      rx="1.5"
      fill="none"
      stroke="url(#logo-gold)"
      stroke-width="1.2"
      opacity="0.85"
    />
    <circle cx="11" cy="13" r="1.6" fill="url(#logo-gold)" />
    <circle cx="53" cy="13" r="1.6" fill="url(#logo-gold)" />
    <circle cx="11" cy="51" r="1.6" fill="url(#logo-gold)" />
    <circle cx="53" cy="51" r="1.6" fill="url(#logo-gold)" />
    <text
      x="32"
      y="46"
      text-anchor="middle"
      font-family="'Brush Script MT','Lucida Handwriting','Segoe Script',cursive"
      font-style="italic"
      font-weight="700"
      font-size="34"
      fill="currentColor"
    >f</text>
  </svg>
  {#if withWordmark}
    <span class="wordmark">photo wall</span>
  {/if}
</span>

<style>
  .logo {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    color: #fff;
  }
  .mark {
    flex-shrink: 0;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
  }
  .wordmark {
    font-family: 'Brush Script MT', 'Lucida Handwriting', 'Segoe Script', cursive;
    font-style: italic;
    font-size: calc(var(--logo-size) * 0.55);
    line-height: 1;
    color: currentColor;
    letter-spacing: 0.5px;
  }
</style>
