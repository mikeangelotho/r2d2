import { createSignal, For, Show, createEffect, onCleanup } from "solid-js";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

interface PreviewItem {
  path: string;
  value: string;
  type: "url" | "image";
}

interface Props {
  data: unknown;
}

function findPreviews(obj: unknown, path = ""): PreviewItem[] {
  const result: PreviewItem[] = [];
  
  if (obj === null || obj === undefined) {
    return result;
  }
  
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const currentPath = path ? `${path}[${index}]` : String(index);
      result.push(...findPreviews(item, currentPath));
    });
  } else if (typeof obj === "object") {
    Object.entries(obj as JsonObject).forEach(([k, v]) => {
      const currentPath = path ? `${path}.${k}` : k;
      
      if (typeof v === "string") {
        if (v.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) {
          result.push({ path: currentPath, value: v, type: "image" });
        } else if (v.match(/^https?:\/\/.+/i)) {
          result.push({ path: currentPath, value: v, type: "url" });
        }
      } else if (typeof v === "object" && v !== null) {
        result.push(...findPreviews(v, currentPath));
      }
    });
  }
  
  return result;
}

function ImagePreview(props: { url: string; path: string }) {
  const [loaded, setLoaded] = createSignal(false);
  const [error, setError] = createSignal(false);
  
  return (
    <div class="bg-slate-800 rounded p-2">
      <div class="text-xs text-gray-500 mb-1 truncate">{props.path}</div>
      <Show when={!loaded() && !error()}>
        <div class="h-24 flex items-center justify-center text-gray-500">
          Loading...
        </div>
      </Show>
      <Show when={error()}>
        <div class="h-24 flex items-center justify-center text-red-400 text-sm">
          Failed to load
        </div>
      </Show>
      <img
        src={props.url}
        alt={props.path}
        class={`max-h-32 rounded ${loaded() ? "block" : "hidden"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

function LinkPreview(props: { url: string; path: string }) {
  const [title, setTitle] = createSignal<string | null>(null);
  const [favicon, setFavicon] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(false);
  
  createEffect(() => {
    const url = props.url;
    try {
      const urlObj = new URL(url);
      setFavicon(`${urlObj.origin}/favicon.ico`);
    } catch {
      // Invalid URL
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(false);
      setError(true);
    }, 5000);
    
    onCleanup(() => {
      clearTimeout(timeout);
      controller.abort();
    });
  });
  
  const domain = () => {
    try {
      return new URL(props.url).hostname;
    } catch {
      return props.url;
    }
  };
  
  return (
    <div class="bg-slate-800 rounded p-2">
      <div class="text-xs text-gray-500 mb-1 truncate">{props.path}</div>
      <a
        href={props.url}
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-2 hover:bg-slate-700 p-2 rounded transition-colors"
      >
        <Show when={favicon()}>
          <img
            src={favicon()!}
            alt=""
            class="w-4 h-4"
            onError={() => setFavicon(null)}
          />
        </Show>
        <Show when={!favicon()}>
          <span class="w-4 h-4 bg-slate-600 rounded text-xs flex items-center justify-center">🔗</span>
        </Show>
        <span class="text-sky-400 text-sm truncate">{domain()}</span>
      </a>
    </div>
  );
}

export default function PreviewPane(props: Props) {
  const previews = () => findPreviews(props.data);
  
  return (
    <div class="space-y-3 overflow-auto max-h-full">
      <Show when={previews().length === 0}>
        <p class="text-gray-500 text-sm">No URLs or images found in the JSON</p>
      </Show>
      
      <For each={previews().filter(p => p.type === "image")}>
        {(preview) => (
          <ImagePreview url={preview.value} path={preview.path} />
        )}
      </For>
      
      <For each={previews().filter(p => p.type === "url")}>
        {(preview) => (
          <LinkPreview url={preview.value} path={preview.path} />
        )}
      </For>
    </div>
  );
}
