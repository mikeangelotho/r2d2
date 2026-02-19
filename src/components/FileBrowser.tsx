import { createSignal, For, Show, onMount, createEffect } from "solid-js";
import { serverListJsonFiles } from "~/lib/r2-server";
import type { R2File } from "~/lib/r2";

interface Props {
  onFileSelect: (key: string) => void;
  selectedFile: string | null;
  refreshTrigger: number;
  onCreateFromTemplate?: (key: string) => void;
}

export default function FileBrowser(props: Props) {
  const [files, setFiles] = createSignal<R2File[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [isOpen, setIsOpen] = createSignal(false);
  const [bucketName, setBucketName] = createSignal<string | undefined>(
    undefined,
  );

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
    setBucketName(localStorage.getItem("r2_bucket_name") || undefined);
  });

  createEffect(() => {
    props.refreshTrigger;
    loadFiles();
  });

  const selectedFileName = () => {
    if (!props.selectedFile) return null;
    return props.selectedFile.split("/").pop();
  };

  return (
    <div class="relative">
      <Show when={bucketName()}>
        <div class="text-xs text-[var(--text-muted)] mb-1 px-1">
          {bucketName()}
        </div>
      </Show>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen())}
        class="w-full flex items-center justify-between card px-2 py-1.5 text-left hover:border-[var(--border-subtle-hover)] transition-colors"
      >
        <div class="flex items-center gap-2 min-w-0">
          <Show
            when={props.selectedFile}
            fallback={
              <span class="text-[var(--text-muted)]">Select file...</span>
            }
          >
            <span class="text-sm text-[var(--text-primary)] truncate">
              {selectedFileName()}
            </span>
          </Show>
        </div>
        <svg
          class="w-4 h-4 text-[var(--text-muted)] shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <Show when={isOpen()}>
        <div class="absolute top-full left-0 right-0 mt-1 card max-h-48 overflow-y-auto z-20 shadow-lg">
          <div class="sticky top-0 flex items-center justify-between px-2 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <span class="text-xs text-[var(--text-muted)]">
              {files().length} files
            </span>
            <div class="flex items-center gap-2">
              <Show when={props.onCreateFromTemplate}>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    props.onCreateFromTemplate!("");
                  }}
                  class="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]"
                >
                  + New
                </button>
              </Show>
              <button
                type="button"
                onClick={loadFiles}
                disabled={loading()}
                class="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                ↻
              </button>
            </div>
          </div>

          <Show when={error()}>
            <div class="px-3 py-2 text-xs text-[var(--error)]">{error()}</div>
          </Show>

          <Show when={files().length === 0 && !loading() && !error()}>
            <div class="px-3 py-4 text-center text-xs text-[var(--text-muted)]">
              No files found
            </div>
          </Show>

          <For each={files()}>
            {(file) => (
              <button
                type="button"
                onClick={() => {
                  props.onFileSelect(file.key);
                  setIsOpen(false);
                }}
                class={`w-full text-left px-2 py-1.5 text-sm border-b border-[var(--border-subtle)] last:border-0 transition-colors ${
                  props.selectedFile === file.key
                    ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                    : "hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <div class="flex items-center justify-between">
                  <span class="truncate">{file.key.split("/").pop()}</span>
                  <Show when={file.size !== undefined}>
                    <span class="text-xs text-[var(--text-muted)] ml-2 shrink-0">
                      {(file.size! / 1024).toFixed(1)}K
                    </span>
                  </Show>
                </div>
                <Show when={file.key.includes("/")}>
                  <div class="text-xs text-[var(--text-muted)] truncate mt-0.5">
                    {file.key.split("/").slice(0, -1).join("/")}
                  </div>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={isOpen()}>
        <div class="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
      </Show>
    </div>
  );
}
