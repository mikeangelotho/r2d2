import {
  createSignal,
  For,
  Show,
  createEffect,
  onCleanup,
  createMemo,
} from "solid-js";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

interface PreviewItem {
  path: string;
  value: string;
  type: "url" | "image";
  parentPath: string;
}

interface PreviewGroup {
  path: string;
  items: PreviewItem[];
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
        if (
          v.match(
            /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg|ico|avif|apng|bmp|tiff|webp)(\?.*)?$/i,
          )
        ) {
          result.push({
            path: currentPath,
            value: v,
            type: "image",
            parentPath: path,
          });
        } else if (v.match(/^https?:\/\/.+/i)) {
          result.push({
            path: currentPath,
            value: v,
            type: "url",
            parentPath: path,
          });
        }
      } else if (typeof v === "object" && v !== null) {
        result.push(...findPreviews(v, currentPath));
      }
    });
  }

  return result;
}

function getTopLevelKeys(obj: unknown): string[] {
  if (obj === null || obj === undefined) return [];
  if (Array.isArray(obj)) {
    return obj.map((_, i) => String(i));
  }
  if (typeof obj === "object") {
    return Object.keys(obj as JsonObject);
  }
  return [];
}

function getTopLevelParent(parentPath: string): string {
  if (!parentPath) return "root";
  const dotIndex = parentPath.indexOf(".");
  const bracketIndex = parentPath.indexOf("[");
  if (dotIndex === -1 && bracketIndex === -1) return parentPath;
  if (dotIndex === -1) return parentPath.substring(0, bracketIndex);
  if (bracketIndex === -1) return parentPath.substring(0, dotIndex);
  return parentPath.substring(0, Math.min(dotIndex, bracketIndex));
}

function groupPreviews(
  items: PreviewItem[],
  topLevelKeys: string[],
): PreviewGroup[] {
  const groups: Map<string, PreviewItem[]> = new Map();

  for (const key of topLevelKeys) {
    groups.set(key, []);
  }
  groups.set("root", []);

  for (const item of items) {
    const topLevel = getTopLevelParent(item.parentPath);
    const existing = groups.get(topLevel) || [];
    existing.push(item);
    groups.set(topLevel, existing);
  }

  return Array.from(groups.entries())
    .map(([path, items]) => ({
      path,
      items: items.sort((a, b) => {
        if (a.type === "image" && b.type !== "image") return -1;
        if (a.type !== "image" && b.type === "image") return 1;
        return 0;
      }),
    }))
    .sort((a, b) => {
      if (a.path === "root") return -1;
      if (b.path === "root") return 1;

      const aNum = parseInt(a.path, 10);
      const bNum = parseInt(b.path, 10);
      const aIsNum = !isNaN(aNum) && a.path === String(aNum);
      const bIsNum = !isNaN(bNum) && b.path === String(bNum);

      if (aIsNum && bIsNum) return aNum - bNum;
      if (aIsNum) return -1;
      if (bIsNum) return 1;

      return a.path.localeCompare(b.path);
    });
}

function ImagePreview(props: { url: string; path: string }) {
  const [loaded, setLoaded] = createSignal(false);
  const [error, setError] = createSignal(false);

  return (
    <div class="bg-[var(--bg-secondary)] rounded p-3">
      <div class="text-xs text-[var(--text-muted)] mb-2 truncate">
        {props.path}
      </div>
      <Show when={!loaded() && !error()}>
        <div class="h-24 flex items-center justify-center text-[var(--text-muted)]">
          Loading...
        </div>
      </Show>
      <Show when={error()}>
        <div class="h-24 flex items-center justify-center text-[var(--error)] text-sm">
          Failed to load
        </div>
      </Show>
      <img
        src={props.url}
        alt={props.path}
        class={`rounded max-h-32 ${loaded() ? "block" : "hidden"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

function LinkPreview(props: { url: string; path: string }) {
  const [favicon, setFavicon] = createSignal<string | null>(null);

  createEffect(() => {
    const url = props.url;
    try {
      const urlObj = new URL(url);
      setFavicon(`${urlObj.origin}/favicon.ico`);
    } catch {}

    const controller = new AbortController();

    onCleanup(() => {
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
    <div class="bg-[var(--bg-secondary)] rounded p-3">
      <div class="text-xs text-[var(--text-muted)] mb-2 truncate">
        {props.path}
      </div>
      <a
        href={props.url}
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-2 hover:bg-[var(--bg-tertiary)] p-2 rounded transition-colors"
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
          <span class="w-4 h-4 bg-[var(--bg-tertiary)] rounded text-xs flex items-center justify-center">
            🔗
          </span>
        </Show>
        <span class="text-sky-400 text-sm truncate">{domain()}</span>
      </a>
    </div>
  );
}

function PreviewGroup(props: { group: PreviewGroup }) {
  const [collapsed, setCollapsed] = createSignal(true);
  const isRoot = () => props.group.path === "root";

  const imageCount = () =>
    props.group.items.filter((i) => i.type === "image").length;
  const urlCount = () =>
    props.group.items.filter((i) => i.type === "url").length;

  const displayPath = () => {
    if (props.group.path === "root") return "Root Level";
    return props.group.path;
  };

  const handleToggle = () => {
    if (!isRoot()) {
      setCollapsed(!collapsed());
    }
  };

  return (
    <div class="border border-[var(--border-subtle)] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        class={`w-full flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors ${isRoot() ? "cursor-default" : ""}`}
      >
        <div class="flex items-center gap-2">
          <span class="text-[var(--text-primary)] text-sm font-medium">
            {displayPath()}
          </span>
          <Show when={imageCount() > 0}>
            <span class="text-xs bg-[var(--accent)]/20 text-[var(--accent)] px-2 py-0.5 rounded">
              {imageCount()} image{imageCount() !== 1 ? "s" : ""}
            </span>
          </Show>
          <Show when={urlCount() > 0}>
            <span class="text-xs bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded">
              {urlCount()} link{urlCount() !== 1 ? "s" : ""}
            </span>
          </Show>
        </div>
        <Show when={!isRoot()}>
          <span class="text-[var(--text-muted)] text-xs">
            {collapsed() ? "▶" : "▼"}
          </span>
        </Show>
      </button>

      <Show when={isRoot() || !collapsed()}>
        <div class="p-3 space-y-3">
          <Show when={imageCount() > 0}>
            <div class="grid grid-cols-2 gap-3">
              <For each={props.group.items.filter((i) => i.type === "image")}>
                {(preview) => (
                  <ImagePreview url={preview.value} path={preview.path} />
                )}
              </For>
            </div>
          </Show>

          <Show when={urlCount() > 0}>
            <div class="space-y-2">
              <For each={props.group.items.filter((i) => i.type === "url")}>
                {(preview) => (
                  <LinkPreview url={preview.value} path={preview.path} />
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default function PreviewPane(props: Props) {
  const previews = createMemo(() => findPreviews(props.data));
  const topLevelKeys = createMemo(() => getTopLevelKeys(props.data));
  const grouped = createMemo(() => groupPreviews(previews(), topLevelKeys()));

  return (
    <div class="space-y-3 overflow-auto max-h-full">
      <Show when={previews().length === 0}>
        <p class="text-[var(--text-muted)] text-sm">
          No URLs or images found in the JSON
        </p>
      </Show>

      <For each={grouped()}>{(group) => <PreviewGroup group={group} />}</For>
    </div>
  );
}
