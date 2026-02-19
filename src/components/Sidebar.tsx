import {
  createSignal,
  Show,
  For,
  onMount,
  createEffect,
  createMemo,
} from "solid-js";
import { serverListJsonFiles } from "~/lib/r2-server";
import type { R2File } from "~/lib/r2";

interface Props {
  selectedFile: string | null;
  onFileSelect: (key: string) => void;
  refreshTrigger: number;
  onCreateFromTemplate?: (key: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: "folder" | "file";
  children: TreeNode[];
  expanded?: boolean;
}

function buildFileTree(files: R2File[]): TreeNode[] {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, TreeNode>();

  files
    .sort((a, b) => a.key.localeCompare(b.key))
    .forEach((file) => {
      const parts = file.key.split("/").filter(Boolean);
      let currentPath = "";
      let currentLevel = root;

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isLast = index === parts.length - 1;
        const isFolder = !isLast;

        let node = folderMap.get(currentPath);

        if (!node) {
          node = {
            name: part,
            path: currentPath,
            type: isFolder ? "folder" : "file",
            children: [],
            expanded: false,
          };
          folderMap.set(currentPath, node);
          currentLevel.push(node);
        }

        currentLevel = node.children;
      });
    });

  return root;
}

function TreeItem(props: {
  node: TreeNode;
  level: number;
  selectedFile: string | null;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  onCreateFromTemplate: ((key: string) => void) | undefined;
}) {
  const isSelected = () =>
    props.node.type === "file" && props.selectedFile === props.node.path;
  const hasChildren = () => props.node.children.length > 0;

  return (
    <div class="select-none">
      <div
        class={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-all group ${
          isSelected()
            ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
            : "hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
        style={{ "padding-left": `${props.level * 12 + 8}px` }}
        onClick={() => {
          if (props.node.type === "folder") {
            props.onToggle(props.node.path);
          } else {
            props.onSelect(props.node.path);
          }
        }}
      >
        <Show when={props.node.type === "folder"}>
          <Show
            when={props.node.expanded}
            fallback={
              <svg
                class="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            }
          >
            <svg
              class="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0"
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
          </Show>
        </Show>
        <Show when={props.node.type === "folder"}>
          <Show
            when={props.node.expanded}
            fallback={
              <svg
                class="w-4 h-4 text-[var(--warning)] shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.097.903 2 2 2h16c1.097 0 2-.903 2-2V8c0-1.097-.903-2-2-2h-8l-2-2z" />
              </svg>
            }
          >
            <svg
              class="w-4 h-4 text-[var(--warning)] shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
            </svg>
          </Show>
        </Show>
        <Show when={props.node.type === "file"}>
          <span class="w-[22px]" />
        </Show>
        <span class="truncate text-sm">{props.node.name}</span>
        <Show when={props.node.type === "file"}>
          <span class="ml-auto text-xs text-[var(--text-muted)] opacity-0 group-hover:opacity-100">
            {(props.node as any).size ? `${(props.node as any).size}kb` : ""}
          </span>
        </Show>
      </div>

      <Show when={props.node.type === "folder" && props.node.expanded}>
        <For each={props.node.children}>
          {(child) => (
            <TreeItem
              node={child}
              level={props.level + 1}
              selectedFile={props.selectedFile}
              onSelect={props.onSelect}
              onToggle={props.onToggle}
              onCreateFromTemplate={props.onCreateFromTemplate}
            />
          )}
        </For>
      </Show>
    </div>
  );
}

export default function Sidebar(props: Props) {
  const [files, setFiles] = createSignal<R2File[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(
    new Set(),
  );

  const loadFiles = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await serverListJsonFiles();
      setFiles(result);
      const allFolders = new Set<string>();
      result.forEach((file) => {
        const parts = file.key.split("/").filter(Boolean);
        let path = "";
        parts.forEach((part, index) => {
          if (index < parts.length - 1) {
            path = path ? `${path}/${part}` : part;
            allFolders.add(path);
          }
        });
      });
      setExpandedFolders(allFolders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadFiles();
  });

  createEffect(() => {
    props.refreshTrigger;
    loadFiles();
  });

  const fileTree = createMemo(() => buildFileTree(files()));

  const filteredTree = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return fileTree();

    const filterNode = (node: TreeNode): TreeNode | null => {
      if (node.type === "file") {
        if (node.name.toLowerCase().includes(query)) {
          return node;
        }
        return null;
      }

      const filteredChildren = node.children
        .map(filterNode)
        .filter((n): n is TreeNode => n !== null);

      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }

      if (node.name.toLowerCase().includes(query)) {
        return { ...node, children: [] };
      }

      return null;
    };

    return fileTree()
      .map(filterNode)
      .filter((n): n is TreeNode => n !== null);
  });

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleCreateNew = () => {
    if (props.onCreateFromTemplate) {
      props.onCreateFromTemplate("");
    }
  };

  return (
    <div class="h-full flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)]">
      <div class="p-3 border-b border-[var(--border-subtle)]">
        <div class="relative">
          <svg
            class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="input input-sm pl-8 pr-3 bg-[var(--bg-tertiary)] border-transparent focus:border-[var(--accent)]"
          />
        </div>
      </div>

      <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
        <span class="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          Files
        </span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCreateNew}
            class="btn-icon"
            title="New file"
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={loadFiles}
            class="btn-icon"
            disabled={loading()}
            title="Refresh"
          >
            <svg
              class={`w-3.5 h-3.5 ${loading() ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-2">
        <Show when={error()}>
          <div class="px-3 py-2 text-xs text-[var(--error)] bg-[var(--error-subtle)] rounded mb-2">
            {error()}
          </div>
        </Show>

        <Show when={loading()}>
          <div class="flex items-center justify-center gap-2 py-8">
            <svg
              class="w-4 h-4 animate-spin text-[var(--accent)]"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span class="text-sm text-[var(--text-muted)]">Loading...</span>
          </div>
        </Show>

        <Show when={!loading() && filteredTree().length === 0 && !error()}>
          <div class="text-center py-8">
            <svg
              class="mx-auto w-8 h-8 text-[var(--text-muted)] mb-2 opacity-50"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
            </svg>
            <p class="text-sm text-[var(--text-muted)]">No files found</p>
          </div>
        </Show>

        <Show when={!loading() && filteredTree().length > 0}>
          <For each={filteredTree()}>
            {(node) => (
              <TreeItem
                node={{ ...node, expanded: expandedFolders().has(node.path) }}
                level={0}
                selectedFile={props.selectedFile}
                onSelect={props.onFileSelect}
                onToggle={toggleFolder}
                onCreateFromTemplate={props.onCreateFromTemplate}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
