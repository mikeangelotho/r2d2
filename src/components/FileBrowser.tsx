import { createSignal, For, Show, onMount } from "solid-js";
import { serverListJsonFiles } from "~/lib/r2-server";
import type { R2File } from "~/lib/r2";

interface Props {
  onFileSelect: (key: string) => void;
  selectedFile: string | null;
  refreshTrigger: number;
}

export default function FileBrowser(props: Props) {
  const [files, setFiles] = createSignal<R2File[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  
  const loadFiles = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await serverListJsonFiles();
      setFiles(result.sort((a, b) => a.key.localeCompare(b.key)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadFiles();
  });

  return (
    <div class="glass-elevated rounded-lg overflow-hidden h-full flex flex-col">
      <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs text-[var(--text-muted)] tracking-wide">▸</span>
          <span class="font-mono text-xs tracking-wider text-[var(--accent)]">FILES</span>
          <span class="font-mono text-xs text-[var(--text-muted)]">[{files().length}]</span>
        </div>
        <button
          type="button"
          onClick={loadFiles}
          disabled={loading()}
          class="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors font-mono text-xs disabled:opacity-50"
        >
          {loading() ? "LOADING" : "↻"}
        </button>
      </div>
      
      <Show when={error()}>
        <div class="px-4 py-3 border-b border-[var(--border-subtle)]">
          <span class="text-[var(--error)] font-mono text-xs">ERR: {error()}</span>
        </div>
      </Show>
      
      <div class="flex-1 overflow-y-auto">
        <Show when={files().length === 0 && !loading() && !error()}>
          <div class="px-4 py-8 text-center">
            <span class="font-mono text-xs text-[var(--text-muted)]">NO FILES FOUND</span>
          </div>
        </Show>
        
        <For each={files()}>
          {(file) => (
            <button
              type="button"
              onClick={() => props.onFileSelect(file.key)}
              class={`w-full text-left px-4 py-2.5 border-b border-[var(--border-subtle)] transition-all group ${
                props.selectedFile === file.key
                  ? "bg-[var(--accent-subtle)] border-l-2 border-l-[var(--accent)]"
                  : "hover:bg-[var(--bg-elevated)] border-l-2 border-l-transparent"
              }`}
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-[var(--accent)] font-mono text-xs">›</span>
                  <span class={`font-mono text-xs truncate ${
                    props.selectedFile === file.key ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
                  }`}>
                    {file.key.split("/").pop()}
                  </span>
                </div>
                <Show when={file.size !== undefined}>
                  <span class="font-mono text-xs text-[var(--text-muted)] ml-2 shrink-0">
                    {(file.size! / 1024).toFixed(1)}K
                  </span>
                </Show>
              </div>
              <Show when={file.key.includes("/")}>
                <span class="font-mono text-xs text-[var(--text-muted)] opacity-50 pl-5">
                  {file.key.split("/").slice(0, -1).join("/")}
                </span>
              </Show>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
