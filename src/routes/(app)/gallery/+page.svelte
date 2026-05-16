<script lang="ts">
  import { invalidateAll, goto } from '$app/navigation';
  import { page } from '$app/state';
  import Button from '$lib/components/Button.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let selected = $state<Set<number>>(new Set());
  let busy = $state(false);
  let multiselect = $state(false);

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  function selectAll() {
    selected = new Set(data.images.map((i) => i.id));
  }
  function clearSelection() {
    selected = new Set();
  }

  async function deleteOne(id: number) {
    if (!confirm('Delete this photo permanently?')) return;
    busy = true;
    try {
      const res = await fetch(`/api/images/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      const next = new Set(selected);
      next.delete(id);
      selected = next;
      await invalidateAll();
    } finally {
      busy = false;
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} photo${ids.length === 1 ? '' : 's'} permanently?`)) return;
    busy = true;
    try {
      const res = await fetch('/api/images/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error('Bulk delete failed');
      selected = new Set();
      await invalidateAll();
    } finally {
      busy = false;
    }
  }

  function gotoPage(p: number) {
    const url = new URL(page.url);
    url.searchParams.set('page', String(p));
    goto(url, { keepFocus: true, noScroll: false });
  }

  function bytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }
</script>

<svelte:head>
  <title>Gallery · photo wall</title>
</svelte:head>

<div class="container">
  <header class="head">
    <div>
      <h1>Gallery</h1>
      <p class="sub">
        {data.total} photo{data.total === 1 ? '' : 's'} · page {data.page} of {data.totalPages}
      </p>
    </div>
    <div class="head-actions">
      {#if multiselect}
        <Button variant="ghost" onclick={selectAll}>Select all on page</Button>
        <Button variant="ghost" onclick={clearSelection} disabled={selected.size === 0}>
          Clear
        </Button>
        <Button
          variant="danger"
          disabled={selected.size === 0 || busy}
          onclick={bulkDelete}
        >
          Delete {selected.size}
        </Button>
        <Button
          variant="secondary"
          onclick={() => {
            multiselect = false;
            clearSelection();
          }}
        >
          Done
        </Button>
      {:else}
        <Button variant="secondary" onclick={() => (multiselect = true)}>
          Select
        </Button>
        <Button href="/upload">Upload more</Button>
      {/if}
    </div>
  </header>

  {#if data.images.length === 0}
    <div class="empty">
      <h2>No photos yet</h2>
      <p>Upload some to start your wall.</p>
      <Button href="/upload">Go to upload</Button>
    </div>
  {:else}
    <ul class="grid" role="list">
      {#each data.images as img (img.id)}
        {@const isSelected = selected.has(img.id)}
        <li class="cell" class:selected={isSelected}>
          {#if multiselect}
            <div
              class="thumb"
              role="checkbox"
              aria-checked={isSelected}
              tabindex="0"
              onclick={() => toggle(img.id)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle(img.id);
                }
              }}
            >
              <img src={`/api/images/${img.id}/file`} alt={img.original_name} loading="lazy" />
              <span class="check" aria-hidden="true">
                {#if isSelected}
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {/if}
              </span>
              {#if img.favorite}
                <span class="fav" title="Favorite" aria-label="Favorite">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </span>
              {/if}
            </div>
          {:else}
            <div class="thumb">
              <img src={`/api/images/${img.id}/file`} alt={img.original_name} loading="lazy" />
              {#if img.favorite}
                <span class="fav" title="Favorite" aria-label="Favorite">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </span>
              {/if}
            </div>
          {/if}
          <div class="meta">
            <span class="name" title={img.original_name}>{img.original_name}</span>
            <span class="size">{bytes(img.size)}</span>
          </div>
          {#if !multiselect}
            <button class="del" title="Delete" aria-label="Delete photo"
              onclick={() => deleteOne(img.id)} disabled={busy}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          {/if}
        </li>
      {/each}
    </ul>

    {#if data.totalPages > 1}
      <nav class="pager" aria-label="Pagination">
        <Button
          variant="secondary"
          disabled={data.page <= 1}
          onclick={() => gotoPage(data.page - 1)}
        >
          Previous
        </Button>
        <span class="pager-info">Page {data.page} / {data.totalPages}</span>
        <Button
          variant="secondary"
          disabled={data.page >= data.totalPages}
          onclick={() => gotoPage(data.page + 1)}
        >
          Next
        </Button>
      </nav>
    {/if}
  {/if}
</div>

<style>
  .container {
    max-width: var(--content-max-width);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .head h1 { margin: 0; }
  .sub { margin: 4px 0 0; color: var(--color-text-muted); }
  .head-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-3);
  }
  .cell {
    position: relative;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color var(--transition-fast), transform var(--transition-fast);
  }
  .cell.selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-soft);
  }
  .thumb {
    position: relative;
    aspect-ratio: 1 / 1;
    background: var(--color-surface-2);
    cursor: pointer;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .check {
    position: absolute;
    top: 8px;
    left: 8px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid rgba(255, 255, 255, 0.75);
  }
  .selected .check {
    background: var(--color-primary);
    border-color: var(--color-primary);
  }
  .fav {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    color: #ffd166;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .meta {
    padding: 6px 8px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }
  .name {
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .size {
    font-size: var(--font-size-xs);
  }
  .del {
    position: absolute;
    bottom: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    border: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity var(--transition-fast), background-color var(--transition-fast);
  }
  .cell:hover .del { opacity: 1; }
  .del:hover { background: var(--color-danger); }
  .del:disabled { opacity: 0.4; cursor: not-allowed; }

  .pager {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }
  .pager-info { color: var(--color-text-muted); font-size: var(--font-size-sm); }

  .empty {
    text-align: center;
    padding: var(--space-7) var(--space-5);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
  }
  .empty h2 { margin: 0 0 var(--space-2); }
  .empty p { color: var(--color-text-muted); margin: 0 0 var(--space-4); }
</style>
