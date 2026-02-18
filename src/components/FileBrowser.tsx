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
    <div class="bg-slate-800 rounded-lg p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-white font-medium">JSON Files</h2>
        <button
          type="button"
          onClick={loadFiles}
          disabled={loading()}
          class="text-sky-400 hover:text-sky-300 text-sm disabled:opacity-50"
        >
          {loading() ? "Loading..." : "Refresh"}
        </button>
      </div>
      
      <Show when={error()}>
        <p class="text-red-400 text-sm mb-2">{error()}</p>
      </Show>
      
      <div class="space-y-1 max-h-96 overflow-y-auto">
        <Show when={files().length === 0 && !loading() && !error()}>
          <p class="text-gray-500 text-sm">No JSON files found</p>
        </Show>
        
        <For each={files()}>
          {(file) => (
            <button
              type="button"
              onClick={() => props.onFileSelect(file.key)}
              class={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                props.selectedFile === file.key
                  ? "bg-sky-600 text-white"
                  : "text-gray-300 hover:bg-slate-700"
              }`}
            >
              <span class="truncate block">{file.key}</span>
              <Show when={file.size !== undefined}>
                <span class="text-xs text-gray-500">
                  {(file.size! / 1024).toFixed(1)} KB
                </span>
              </Show>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
