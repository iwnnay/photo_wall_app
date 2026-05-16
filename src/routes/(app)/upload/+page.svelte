<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import Alert from '$lib/components/Alert.svelte';

  type ImageRow = {
    id: number;
    filename: string;
    original_name: string;
    mime_type: string;
    size: number;
    favorite: boolean;
    created_at: string;
  };

  type Skipped = { name: string; reason: string };

  let dragOver = $state(false);
  let uploading = $state(false);
  let session = $state<ImageRow[]>([]);
  let errors = $state<Skipped[]>([]);
  let fileInput: HTMLInputElement | null = $state(null);

  function bytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  async function upload(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!arr.length) {
      errors = [
        ...errors,
        ...Array.from(files)
          .filter((f) => !f.type.startsWith('image/'))
          .map((f) => ({ name: f.name, reason: 'Not an image' }))
      ];
      return;
    }
    uploading = true;
    const fd = new FormData();
    for (const f of arr) fd.append('files', f, f.name);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const text = await res.text();
        errors = [...errors, { name: 'upload', reason: text || res.statusText }];
        return;
      }
      const data = (await res.json()) as { uploaded: ImageRow[]; skipped: Skipped[] };
      session = [...data.uploaded, ...session];
      if (data.skipped?.length) errors = [...errors, ...data.skipped];
    } catch (e) {
      errors = [...errors, { name: 'upload', reason: (e as Error).message }];
    } finally {
      uploading = false;
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    if (e.dataTransfer?.files?.length) {
      upload(e.dataTransfer.files);
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function onDragLeave() {
    dragOver = false;
  }

  function pickFiles() {
    fileInput?.click();
  }

  function onFileChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files?.length) upload(target.files);
    target.value = '';
  }

  function clearErrors() {
    errors = [];
  }
</script>

<svelte:head>
  <title>Upload · photo wall</title>
</svelte:head>

<div class="container">
  <header class="head">
    <h1>Upload photos</h1>
    <p class="sub">Drop images here or browse to upload. Originals are preserved.</p>
  </header>

  <div
    class="dropzone"
    class:drag-over={dragOver}
    class:busy={uploading}
    role="button"
    tabindex="0"
    aria-label="Drop files to upload"
    ondrop={onDrop}
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    onclick={pickFiles}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pickFiles();
      }
    }}
  >
    <svg
      class="dropzone-icon"
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
    <h2 class="dropzone-title">
      {uploading ? 'Uploading…' : 'Drag photos here'}
    </h2>
    <p class="dropzone-sub">or</p>
    <Button onclick={(e) => { e.stopPropagation(); pickFiles(); }} loading={uploading}>
      Browse files
    </Button>
    <p class="dropzone-fine">JPEG, PNG, GIF, WebP, AVIF, BMP, TIFF · up to 100MB each</p>
    <input
      bind:this={fileInput}
      type="file"
      accept="image/*"
      multiple
      hidden
      onchange={onFileChange}
    />
  </div>

  {#if errors.length}
    <div class="errors">
      <Alert variant="danger">
        <div class="errors-head">
          <strong>Some uploads were skipped</strong>
          <button class="link-btn" onclick={clearErrors}>Dismiss</button>
        </div>
        <ul>
          {#each errors as e}
            <li><code>{e.name}</code> — {e.reason}</li>
          {/each}
        </ul>
      </Alert>
    </div>
  {/if}

  {#if session.length}
    <section class="session">
      <header class="session-head">
        <h2>This session</h2>
        <span class="badge-count">{session.length} uploaded</span>
      </header>
      <div class="strip">
        {#each session as img (img.id)}
          <a
            class="tile"
            href={`/api/images/${img.id}/file`}
            target="_blank"
            rel="noreferrer"
            title={`${img.original_name} · ${bytes(img.size)}`}
          >
            <img src={`/api/images/${img.id}/file`} alt={img.original_name} loading="lazy" />
          </a>
        {/each}
      </div>
    </section>
  {:else}
    <Card title="Nothing uploaded yet">
      <p>Your uploads for this session will show here so you can confirm what landed.</p>
    </Card>
  {/if}
</div>

<style>
  .container {
    max-width: var(--content-max-width);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .head h1 {
    margin: 0;
  }
  .sub {
    color: var(--color-text-muted);
    margin: var(--space-2) 0 0;
  }
  .dropzone {
    border: 2px dashed var(--color-border-strong);
    border-radius: var(--radius-xl);
    background: var(--color-surface);
    padding: var(--space-7) var(--space-5);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    text-align: center;
    cursor: pointer;
    transition: border-color var(--transition-fast), background-color var(--transition-fast),
      transform var(--transition-fast);
  }
  .dropzone:hover {
    border-color: #fff;
    background: var(--color-surface-2);
  }
  .dropzone.drag-over {
    border-color: var(--color-primary);
    background: var(--color-primary-soft);
    transform: scale(1.01);
  }
  .dropzone.busy {
    cursor: progress;
  }
  .dropzone-icon { color: var(--color-text); opacity: 0.9; }
  .dropzone-title { margin: var(--space-3) 0 0; }
  .dropzone-sub { color: var(--color-text-muted); margin: 0; }
  .dropzone-fine { color: var(--color-text-muted); font-size: var(--font-size-sm); margin: var(--space-3) 0 0; }

  .errors-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-2);
  }
  .errors ul { margin: 0; padding-left: 1.1rem; }
  .link-btn {
    background: transparent;
    border: 0;
    color: inherit;
    text-decoration: underline;
    cursor: pointer;
    font: inherit;
  }

  .session-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .session-head h2 { margin: 0; }
  .badge-count {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .strip {
    display: flex;
    gap: var(--space-3);
    overflow-x: auto;
    padding-bottom: var(--space-3);
  }
  .tile {
    flex: 0 0 auto;
    width: 140px;
    height: 140px;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    text-decoration: none;
    box-shadow: var(--shadow-sm);
    transition: transform var(--transition-fast);
  }
  .tile:hover { transform: translateY(-2px); text-decoration: none; }
  .tile img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
</style>
