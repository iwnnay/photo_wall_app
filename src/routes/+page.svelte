<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  type Image = {
    id: number;
    filename: string;
    original_name: string;
    mime_type: string;
    size: number;
    width: number | null;
    height: number | null;
    favorite: boolean;
    created_at: string;
  };

  const ANIMATIONS = [
    'fade',
    'zoom-in',
    'slide-left',
    'slide-right',
    'slide-up',
    'slide-down',
    'ken-burns'
  ] as const;
  type Animation = (typeof ANIMATIONS)[number];

  const SLIDE_INTERVAL_MS = 6000;
  const REFRESH_LIST_MS = 60_000;

  let images = $state<Image[]>([]);
  let order = $state<number[]>([]);
  let cursor = $state(0);
  let current = $state<Image | null>(null);
  let animation = $state<Animation>('fade');
  let actionBarOpen = $state(false);
  let toast = $state<string | null>(null);
  let loading = $state(true);
  let busy = $state(false);

  let slideTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickAnimation(): Animation {
    return ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
  }

  async function loadImageList() {
    try {
      const res = await fetch('/api/images?page=1&pageSize=10000');
      if (!res.ok) throw new Error('Failed to load images');
      const data = (await res.json()) as { images: Image[] };
      images = data.images;
      // Build a fresh shuffle while keeping the current image in front so we
      // don't yank what's on screen.
      const remaining = images.filter((i) => i.id !== current?.id);
      const next = shuffle(remaining).map((i) => i.id);
      const front = current ? [current.id] : [];
      order = [...front, ...next];
      cursor = current ? 0 : -1;
    } finally {
      loading = false;
    }
  }

  function step(direction: 1 | -1) {
    if (images.length === 0) {
      current = null;
      return;
    }
    cursor += direction;
    if (cursor >= order.length) {
      order = shuffle(images.map((i) => i.id));
      cursor = 0;
    } else if (cursor < 0) {
      order = shuffle(images.map((i) => i.id));
      cursor = order.length - 1;
    }
    const id = order[cursor];
    const found = images.find((i) => i.id === id);
    if (!found) {
      images = images.filter((i) => i.id !== id);
      order = order.filter((x) => x !== id);
      if (cursor >= order.length) cursor = order.length - 1;
      if (!order.length) {
        current = null;
        return;
      }
      step(direction);
      return;
    }
    animation = direction === 1 ? pickAnimation() : 'slide-right';
    current = found;
  }

  function advance() {
    step(1);
  }

  function rewind() {
    step(-1);
  }

  function scheduleNext() {
    clearTimers();
    if (actionBarOpen) return;
    slideTimer = setTimeout(() => {
      advance();
      scheduleNext();
    }, SLIDE_INTERVAL_MS);
  }

  function clearTimers() {
    if (slideTimer) {
      clearTimeout(slideTimer);
      slideTimer = null;
    }
  }

  function showToast(msg: string) {
    toast = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 2400);
  }

  const SWIPE_THRESHOLD = 50; // px
  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;
  let suppressNextClick = false;

  function onStageClick(e: MouseEvent) {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('.action-bar')) return;
    if (target.closest('.corner-link')) return;
    if (!current) return;
    actionBarOpen = !actionBarOpen;
    if (actionBarOpen) {
      clearTimers();
    } else {
      scheduleNext();
    }
  }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchActive = true;
  }

  function onTouchEnd(e: TouchEvent) {
    if (!touchActive) return;
    touchActive = false;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    // Treat as swipe only if horizontal movement dominates and exceeds threshold.
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      suppressNextClick = true;
      if (dx < 0) advance();
      else rewind();
      if (!actionBarOpen) scheduleNext();
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && actionBarOpen) {
      actionBarOpen = false;
      scheduleNext();
      return;
    }
    if (e.key === 'ArrowRight') {
      advance();
      if (!actionBarOpen) scheduleNext();
      return;
    }
    if (e.key === 'ArrowLeft') {
      rewind();
      if (!actionBarOpen) scheduleNext();
      return;
    }
    if (e.key === 'f' || e.key === 'F') {
      toggleFavorite();
    }
  }

  async function toggleFavorite() {
    if (!current || busy) return;
    busy = true;
    const next = !current.favorite;
    try {
      const res = await fetch(`/api/images/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: next })
      });
      if (!res.ok) throw new Error('Favorite failed');
      const updated = (await res.json()) as Image;
      images = images.map((i) => (i.id === updated.id ? updated : i));
      current = updated;
      showToast(updated.favorite ? 'Added to favorites' : 'Removed from favorites');
    } catch (e) {
      showToast('Could not update favorite');
    } finally {
      busy = false;
    }
  }

  async function shareCurrent() {
    if (!current) return;
    const url = `${location.origin}/api/images/${current.id}/file`;
    const shareData: ShareData = {
      title: current.original_name,
      text: 'Check out this photo',
      url
    };
    try {
      if (navigator.share) {
        // Try to attach the actual file when possible (mobile)
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const file = new File([blob], current.original_name, { type: blob.type });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: shareData.title });
            return;
          }
        } catch {
          // fall through to URL share
        }
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard');
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
      showToast('Share unavailable — link copied');
      try {
        await navigator.clipboard.writeText(url);
      } catch {}
    }
  }

  async function deleteCurrent() {
    if (!current || busy) return;
    if (!confirm('Delete this photo permanently?')) return;
    busy = true;
    const id = current.id;
    try {
      const res = await fetch(`/api/images/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      images = images.filter((i) => i.id !== id);
      order = order.filter((x) => x !== id);
      if (cursor >= order.length) cursor = order.length - 1;
      actionBarOpen = false;
      showToast('Photo deleted');
      advance();
      scheduleNext();
    } catch {
      showToast('Could not delete photo');
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    (async () => {
      await loadImageList();
      if (images.length) {
        advance();
        scheduleNext();
      }
      refreshTimer = setInterval(() => {
        loadImageList();
      }, REFRESH_LIST_MS);
    })();
  });

  onDestroy(() => {
    clearTimers();
    if (refreshTimer) clearInterval(refreshTimer);
    if (toastTimer) clearTimeout(toastTimer);
  });
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
  <title>photo wall</title>
</svelte:head>

<div
  class="stage"
  role="button"
  tabindex="0"
  aria-label="Slideshow stage"
  onclick={onStageClick}
  ontouchstart={onTouchStart}
  ontouchend={onTouchEnd}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') onStageClick(e as unknown as MouseEvent);
  }}
>
  {#if loading}
    <div class="status">Loading…</div>
  {:else if !current}
    <div class="empty">
      <h1>No photos yet</h1>
      <p>Upload some to get the wall going.</p>
      <a class="cta" href="/upload">Go to upload</a>
    </div>
  {:else}
    {#key current.id}
      <img
        class="photo anim-{animation}"
        src="/api/images/{current.id}/file"
        alt={current.original_name}
        draggable="false"
      />
    {/key}
  {/if}

  <div class="action-bar" class:open={actionBarOpen} aria-hidden={!actionBarOpen}>
    <div class="action-bar-inner">
      <button class="abtn" onclick={shareCurrent} disabled={!current}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        <span>Share</span>
      </button>
      <button class="abtn" onclick={toggleFavorite} disabled={!current || busy}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill={current?.favorite ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>{current?.favorite ? 'Favorited' : 'Favorite'}</span>
      </button>
      <button class="abtn danger" onclick={deleteCurrent} disabled={!current || busy}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
        <span>Delete</span>
      </button>
    </div>
  </div>

  <a class="corner-link" href="/upload" aria-label="Go to upload">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
  </a>

  {#if toast}
    <div class="toast" role="status">{toast}</div>
  {/if}
</div>

<style>
  .stage {
    position: fixed;
    inset: 0;
    background: #000;
    overflow: hidden;
    cursor: pointer;
    outline: none;
  }

  .photo {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
    will-change: transform, opacity;
  }

  .anim-fade {
    animation: fade 1200ms ease both;
  }
  .anim-zoom-in {
    animation: zoom-in 1400ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }
  .anim-slide-left {
    animation: slide-left 900ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }
  .anim-slide-right {
    animation: slide-right 900ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }
  .anim-slide-up {
    animation: slide-up 900ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }
  .anim-slide-down {
    animation: slide-down 900ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }
  .anim-ken-burns {
    animation: ken-burns 7000ms ease-out both;
  }

  @keyframes fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes zoom-in {
    from { opacity: 0; transform: scale(0.85); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes slide-left {
    from { opacity: 0; transform: translateX(8%); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slide-right {
    from { opacity: 0; transform: translateX(-8%); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(8%); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes slide-down {
    from { opacity: 0; transform: translateY(-8%); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ken-burns {
    from { opacity: 0; transform: scale(1.0); }
    10%  { opacity: 1; }
    to   { opacity: 1; transform: scale(1.12); }
  }

  .action-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.78), rgba(0, 0, 0, 0.55));
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    transform: translateY(-100%);
    transition: transform 280ms cubic-bezier(0.2, 0.7, 0.3, 1);
    z-index: 10;
    pointer-events: none;
  }
  .action-bar.open {
    transform: translateY(0);
    pointer-events: auto;
  }
  .action-bar-inner {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-4) var(--space-5);
    color: #fff;
  }
  .abtn {
    appearance: none;
    background: transparent;
    color: inherit;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: var(--radius-full);
    padding: 0.55rem 1.1rem;
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font: inherit;
    cursor: pointer;
    transition: background-color var(--transition-fast), border-color var(--transition-fast);
  }
  .abtn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.4);
  }
  .abtn:disabled { opacity: 0.55; cursor: not-allowed; }
  .abtn.danger:hover:not(:disabled) {
    background: rgba(255, 80, 80, 0.18);
    border-color: rgba(255, 120, 120, 0.6);
  }

  .corner-link {
    position: absolute;
    right: 14px;
    bottom: 14px;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-full);
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    opacity: 0.6;
    transition: opacity var(--transition-fast), background-color var(--transition-fast);
    z-index: 5;
  }
  .corner-link:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.7);
    text-decoration: none;
  }

  .status,
  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: rgba(255, 255, 255, 0.85);
    gap: var(--space-3);
    text-align: center;
    padding: var(--space-5);
  }
  .empty h1 {
    margin: 0;
    color: #fff;
  }
  .empty p {
    margin: 0;
    color: rgba(255, 255, 255, 0.7);
  }
  .cta {
    margin-top: var(--space-3);
    display: inline-block;
    padding: 0.6rem 1.2rem;
    border-radius: var(--radius-full);
    background: var(--color-primary);
    color: var(--color-primary-fg);
    text-decoration: none;
  }
  .cta:hover { text-decoration: none; filter: brightness(1.05); }

  .toast {
    position: absolute;
    left: 50%;
    bottom: 60px;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.78);
    color: #fff;
    padding: 0.55rem 1rem;
    border-radius: var(--radius-full);
    font-size: var(--font-size-sm);
    box-shadow: var(--shadow-md);
    animation: toast-in 200ms ease both;
    z-index: 20;
  }
  @keyframes toast-in {
    from { opacity: 0; transform: translate(-50%, 6px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }
</style>
