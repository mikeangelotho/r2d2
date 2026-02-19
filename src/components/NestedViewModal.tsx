import { createSignal, createMemo, Show, For } from "solid-js";
import JsonTreeView from "./JsonTreeView";
import JsonTableView from "./JsonTableView";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

interface BreadcrumbItem {
  key: string;
  path: string[];
}

interface Props {
  data: unknown;
  rootData: unknown;
  basePath: string[];
  onClose: () => void;
  onSave: (path: string[], newData: unknown) => void;
  onDrillDown: (path: string[]) => void;
}

function getValueAtPath(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) return null;
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return null;
    }
  }
  return current;
}

export default function NestedViewModal(props: Props) {
  const [viewMode, setViewMode] = createSignal<"tree" | "table">("tree");
  const [currentPath, setCurrentPath] = createSignal<string[]>(props.basePath);
  const [localData, setLocalData] = createSignal<unknown>(
    getValueAtPath(props.data, props.basePath),
  );

  const currentData = createMemo(() => {
    return getValueAtPath(props.data, currentPath());
  });

  const breadcrumbs = createMemo((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [{ key: "root", path: [] }];
    let path: string[] = [];

    for (let i = 0; i < props.basePath.length; i++) {
      path = [...path, props.basePath[i]];
      const key = props.basePath[i];
      const displayKey = isNaN(Number(key)) ? key : `[${key}]`;
      items.push({ key: displayKey, path });
    }

    return items;
  });

  const handleBreadcrumbClick = (path: string[]) => {
    setCurrentPath(path);
    setLocalData(getValueAtPath(props.data, path));
  };

  const handleChange = (path: string[], newData: unknown) => {
    const fullPath = [...currentPath(), ...path];
    props.onSave(fullPath, newData);
  };

  const handleDrillDown = (path: string[]) => {
    const fullPath = [...currentPath(), ...path];
    setCurrentPath(fullPath);
    setLocalData(getValueAtPath(props.data, fullPath));
    props.onDrillDown(fullPath);
  };

  const isExpandable = (val: unknown): boolean => {
    return (
      val !== null &&
      typeof val === "object" &&
      (Array.isArray(val) || Object.keys(val).length > 0)
    );
  };

  const handleTreeNodeClick = (path: string[], value: unknown) => {
    if (isExpandable(value)) {
      handleDrillDown(path);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="card rounded-lg w-[800px] max-h-[85vh] flex flex-col">
        <div class="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
          <div class="flex items-center gap-2 overflow-x-auto">
            <span class="text-sm text-[var(--accent)]">▸</span>
            <For each={breadcrumbs()}>
              {(item, index) => (
                <>
                  <Show when={index() > 0}>
                    <span class="text-[var(--text-muted)]">/</span>
                  </Show>
                  <button
                    type="button"
                    onClick={() => handleBreadcrumbClick(item.path)}
                    class={`text-sm hover:text-[var(--accent)] transition-colors ${
                      index() === breadcrumbs().length - 1
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {item.key}
                  </button>
                </>
              )}
            </For>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            class="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl ml-4 shrink-0"
          >
            ×
          </button>
        </div>

        <div class="flex items-center gap-1 px-5 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
          <button
            type="button"
            onClick={() => setViewMode("tree")}
            class={`px-3 py-1 rounded-full text-xs transition-colors ${
              viewMode() === "tree"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            }`}
          >
            Tree
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            class={`px-3 py-1 rounded-full text-xs transition-colors ${
              viewMode() === "table"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            }`}
          >
            Table
          </button>
          <span class="ml-auto text-xs text-[var(--text-muted)]">
            Click on objects/arrays to drill down
          </span>
        </div>

        <div class="flex-1 overflow-auto p-4">
          <Show when={viewMode() === "tree"}>
            <JsonTreeView
              data={currentData()!}
              onChange={handleChange}
              onNodeClick={handleTreeNodeClick}
            />
          </Show>
          <Show when={viewMode() === "table"}>
            <JsonTableView
              data={currentData()!}
              onChange={handleChange}
              onNodeClick={handleTreeNodeClick}
            />
          </Show>
        </div>

        <div class="flex items-center justify-end px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
          <button
            type="button"
            onClick={props.onClose}
            class="btn-secondary text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
