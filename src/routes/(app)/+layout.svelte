<script lang="ts">
  import type { Snippet } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import NavLink from '$lib/components/NavLink.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import Logo from '$lib/components/Logo.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<AppShell>
  {#snippet brand()}
    <a class="brand" href="/">
      <Logo size={32} withWordmark />
    </a>
  {/snippet}

  {#snippet nav()}
    <nav class="nav-section" aria-label="Primary">
      <NavLink href="/" exact>
        {#snippet icon()}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>
        {/snippet}
        Slideshow
      </NavLink>
      <NavLink href="/upload">
        {#snippet icon()}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        {/snippet}
        Upload
      </NavLink>
      <NavLink href="/gallery">
        {#snippet icon()}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        {/snippet}
        Gallery
      </NavLink>
    </nav>
  {/snippet}

  {#snippet headerActions()}
    <ThemeToggle />
  {/snippet}

  {@render children()}
</AppShell>

<style>
  .nav-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .brand {
    color: inherit;
    text-decoration: none;
  }
  .brand:hover {
    text-decoration: none;
  }
</style>
