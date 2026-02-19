import { createSignal, For, Show, createMemo } from "solid-js";
import {
  serverGetJsonFile,
  serverListJsonFiles,
  serverPutJsonFile,
} from "~/lib/r2-server";
import type { R2File } from "~/lib/r2";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

interface SelectedField {
  sourceFile: string;
  originalPath: string[];
  selectedKey: string;
  value: JsonValue;
}

interface Props {
  onClose: () => void;
  onCreated: (key: string) => void;
  existingFile?: string | null;
  existingData?: JsonObject;
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

function isObject(val: unknown): val is JsonObject {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function isArray(val: unknown): val is JsonArray {
  return Array.isArray(val);
}

export default function TemplatePicker(props: Props) {
  const [files, setFiles] = createSignal<R2File[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [selectedSources, setSelectedSources] = createSignal<
    Map<string, JsonObject>
  >(new Map());
  const [selectedFields, setSelectedFields] = createSignal<SelectedField[]>([]);
  const [activeSource, setActiveSource] = createSignal<string | null>(null);
  const [activePath, setActivePath] = createSignal<string[]>([]);
  const [mode, setMode] = createSignal<"create" | "add">("create");
  const [newFileName, setNewFileName] = createSignal("");
  const [targetFile, setTargetFile] = createSignal<string | null>(
    props.existingFile || null,
  );
  const [targetData, setTargetData] = createSignal<
    JsonObject | JsonArray | null
  >(props.existingData || null);
  const [creating, setCreating] = createSignal(false);
  const [error, setError] = createSignal("");

  const loadFiles = async () => {
    try {
      const result = await serverListJsonFiles();
      setFiles(result.sort((a, b) => a.key.localeCompare(b.key)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  loadFiles();

  const handleSourceSelect = async (key: string) => {
    if (selectedSources().has(key)) {
      setActiveSource(key);
      setActivePath([]);
      return;
    }

    try {
      const data = await serverGetJsonFile(key);
      if (typeof data === "object" && data !== null && !Array.isArray(data)) {
        setSelectedSources((prev) =>
          new Map(prev).set(key, data as JsonObject),
        );
        setActiveSource(key);
        setActivePath([]);
      } else {
        setError("Template source must be an object");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file");
    }
  };

  const handleTargetSelect = async (key: string) => {
    if (targetFile() === key) return;

    try {
      const data = await serverGetJsonFile(key);
      if (typeof data === "object" && data !== null) {
        setTargetFile(key);
        setTargetData(data as JsonObject);
      } else {
        setError("Target file must be an object or array");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file");
    }
  };

  const handleRemoveSource = (key: string) => {
    setSelectedSources((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    setSelectedFields((prev) => prev.filter((f) => f.sourceFile !== key));
    if (activeSource() === key) {
      const remaining = Array.from(selectedSources().keys()).filter(
        (k) => k !== key,
      );
      setActiveSource(remaining[0] || null);
      setActivePath([]);
    }
  };

  const activeSourceData = createMemo(() => {
    const key = activeSource();
    if (!key) return null;
    const source = selectedSources().get(key);
    if (!source) return null;
    return getValueAtPath(source, activePath());
  });

  const activeSourceEntries = createMemo(() => {
    const data = activeSourceData();
    if (!data) return [];
    if (isObject(data)) {
      return Object.entries(data).map(([k, v]) => ({
        key: k,
        value: v,
        isExpandable: v !== null && typeof v === "object",
      }));
    }
    if (isArray(data)) {
      return data.map((v, i) => ({
        key: String(i),
        value: v,
        isExpandable: v !== null && typeof v === "object",
      }));
    }
    return [];
  });

  const handleDrillDown = (key: string) => {
    setActivePath((prev) => [...prev, key]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setActivePath((prev) => prev.slice(0, index));
  };

  const breadcrumbs = createMemo(() => {
    const items: { key: string; path: string[] }[] = [
      { key: "root", path: [] },
    ];
    let path: string[] = [];
    for (const segment of activePath()) {
      path = [...path, segment];
      const displayKey = isNaN(Number(segment)) ? segment : `[${segment}]`;
      items.push({ key: displayKey, path });
    }
    return items;
  });

  const handleToggleField = (key: string, value: JsonValue) => {
    const isSelected = selectedFields().some(
      (f) =>
        f.sourceFile === activeSource() &&
        f.originalPath.length === activePath().length + 1 &&
        f.originalPath[activePath().length] === key,
    );

    if (isSelected) {
      setSelectedFields((prev) =>
        prev.filter(
          (f) =>
            !(
              f.sourceFile === activeSource() &&
              f.originalPath.length === activePath().length + 1 &&
              f.originalPath[activePath().length] === key
            ),
        ),
      );
    } else {
      const fullPath = [...activePath(), key];
      const selectedKey = key;
      setSelectedFields((prev) => [
        ...prev,
        {
          sourceFile: activeSource()!,
          originalPath: fullPath,
          selectedKey,
          value,
        },
      ]);
    }
  };

  const handleRenameField = (originalPath: string[], newName: string) => {
    setSelectedFields((prev) =>
      prev.map((f) =>
        JSON.stringify(f.originalPath) === JSON.stringify(originalPath)
          ? { ...f, selectedKey: newName }
          : f,
      ),
    );
  };

  const isFieldSelected = (key: string) => {
    return selectedFields().some(
      (f) =>
        f.sourceFile === activeSource() &&
        f.originalPath.length === activePath().length + 1 &&
        f.originalPath[activePath().length] === key,
    );
  };

  const getSelectedField = (key: string) => {
    return selectedFields().find(
      (f) =>
        f.sourceFile === activeSource() &&
        f.originalPath.length === activePath().length + 1 &&
        f.originalPath[activePath().length] === key,
    );
  };

  const checkForConflicts = () => {
    if (!targetData() || isArray(targetData())) return [];
    const conflicts: string[] = [];
    for (const field of selectedFields()) {
      if (field.selectedKey in (targetData() as JsonObject)) {
        conflicts.push(field.selectedKey);
      }
    }
    return conflicts;
  };

  const handleCreate = async () => {
    if (mode() === "create") {
      if (!newFileName().trim()) {
        setError("Please enter a file name");
        return;
      }
      if (!newFileName().endsWith(".json")) {
        setError("File name must end with .json");
        return;
      }
    } else {
      if (!targetFile()) {
        setError("Please select a target file");
        return;
      }
      const conflicts = checkForConflicts();
      if (conflicts.length > 0) {
        if (
          !confirm(
            `The following fields already exist and will be overwritten: ${conflicts.join(", ")}. Continue?`,
          )
        ) {
          return;
        }
      }
    }

    if (selectedFields().length === 0) {
      setError("Please select at least one field");
      return;
    }

    setCreating(true);
    setError("");

    try {
      let dataToSave: JsonValue;

      if (mode() === "create") {
        dataToSave = {};
        for (const field of selectedFields()) {
          (dataToSave as JsonObject)[field.selectedKey] = field.value;
        }
      } else {
        if (isArray(targetData())) {
          const newEntry: JsonObject = {};
          for (const field of selectedFields()) {
            newEntry[field.selectedKey] = field.value;
          }
          dataToSave = [...(targetData() as JsonArray), newEntry];
        } else {
          dataToSave = { ...(targetData() as JsonObject) };
          for (const field of selectedFields()) {
            (dataToSave as JsonObject)[field.selectedKey] = field.value;
          }
        }
      }

      const saveKey = mode() === "create" ? newFileName() : targetFile()!;
      await serverPutJsonFile(saveKey, dataToSave);
      props.onCreated(saveKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save file");
    } finally {
      setCreating(false);
    }
  };

  const availableTargetFiles = createMemo(() => {
    return files().filter((f) => f.key !== targetFile());
  });

  const getValuePreview = (value: JsonValue): string => {
    if (value === null) return "null";
    if (typeof value === "string")
      return `"${value.slice(0, 30)}${value.length > 30 ? "..." : ""}"`;
    if (typeof value === "number" || typeof value === "boolean")
      return String(value);
    if (isArray(value)) return `Array[${value.length}]`;
    if (isObject(value)) return `Object{${Object.keys(value).length}}`;
    return String(value);
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="card rounded-lg w-[900px] max-h-[85vh] flex flex-col">
        <div class="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
          <div class="flex items-center gap-4">
            <h2 class="text-base font-medium text-[var(--text-primary)]">
              {mode() === "create"
                ? "Create from Template"
                : "Add from Template"}
            </h2>
            <div class="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMode("create")}
                class={`px-3 py-1 rounded-full text-xs transition-colors ${
                  mode() === "create"
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                New File
              </button>
              <button
                type="button"
                onClick={() => setMode("add")}
                class={`px-3 py-1 rounded-full text-xs transition-colors ${
                  mode() === "add"
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                Add to Existing
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            class="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl"
          >
            ×
          </button>
        </div>

        <Show when={error()}>
          <div class="px-5 py-2 bg-[rgba(239,68,68,0.1)] border-b border-[var(--border-subtle)]">
            <span class="text-sm text-[var(--error)]">{error()}</span>
          </div>
        </Show>

        <div class="flex flex-1 overflow-hidden">
          <div class="w-52 border-r border-[var(--border-subtle)] flex flex-col">
            <div class="px-4 py-3 border-b border-[var(--border-subtle)]">
              <span class="text-xs text-[var(--text-muted)]">
                {mode() === "create" ? "SOURCE FILES" : "SOURCE / TARGET"}
              </span>
            </div>
            <div class="flex-1 overflow-y-auto">
              <Show when={mode() === "add" && targetData()}>
                <div class="px-3 py-2 bg-[var(--accent-subtle)] border-b border-[var(--border-subtle)]">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-[var(--accent)]">TARGET:</span>
                    <span class="text-xs text-[var(--text-muted)]">
                      {isArray(targetData())
                        ? `Array[${(targetData() as JsonArray).length} entries]`
                        : "Object"}
                    </span>
                  </div>
                  <div class="flex items-center justify-between mt-1">
                    <span class="text-xs text-[var(--text-primary)] truncate">
                      {targetFile()?.split("/").pop()}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetFile(null);
                        setTargetData(null);
                      }}
                      class="text-[var(--text-muted)] hover:text-[var(--error)] text-xs"
                    >
                      ×
                    </button>
                  </div>
                  <Show when={isObject(targetData())}>
                    <div class="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                      <span class="text-xs text-[var(--text-muted)]">
                        EXISTING FIELDS:
                      </span>
                      <div class="mt-1 space-y-1 max-h-24 overflow-y-auto">
                        <For each={Object.keys(targetData() as JsonObject)}>
                          {(key) => (
                            <div class="flex items-center gap-2">
                              <span class="text-xs text-green-400">
                                "{key}"
                              </span>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                  <Show when={isArray(targetData())}>
                    <div class="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                      <span class="text-xs text-[var(--text-muted)]">
                        New entry will be appended to array
                      </span>
                    </div>
                  </Show>
                </div>
              </Show>

              <Show when={loading()}>
                <div class="px-4 py-4 text-center">
                  <span class="text-xs text-[var(--text-muted)]">
                    Loading...
                  </span>
                </div>
              </Show>

              <For each={files()}>
                {(file) => {
                  const isSource = selectedSources().has(file.key);
                  const isTarget = targetFile() === file.key;

                  return (
                    <button
                      type="button"
                      onClick={() => {
                        handleSourceSelect(file.key);
                      }}
                      disabled={mode() === "add" && isTarget}
                      class={`w-full text-left px-4 py-2 border-b border-[var(--border-subtle)] transition-colors disabled:opacity-50 ${
                        isSource || isTarget
                          ? "bg-[var(--accent-subtle)]"
                          : "hover:bg-[var(--bg-tertiary)]"
                      }`}
                    >
                      <div class="flex items-center gap-2">
                        <Show when={isSource}>
                          <span class="text-xs text-[var(--accent)]">S</span>
                        </Show>
                        <Show when={isTarget}>
                          <span class="text-xs text-[var(--accent)]">T</span>
                        </Show>
                        <Show when={!isSource && !isTarget}>
                          <span class="text-xs text-[var(--text-muted)]">
                            +
                          </span>
                        </Show>
                        <span
                          class={`text-xs truncate ${
                            isSource || isTarget
                              ? "text-[var(--accent)]"
                              : "text-[var(--text-primary)]"
                          }`}
                        >
                          {file.key.split("/").pop()}
                        </span>
                        <Show when={mode() === "add" && isSource && !isTarget}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTargetSelect(file.key);
                            }}
                            class="ml-auto text-[var(--text-muted)] hover:text-[var(--accent)] text-xs"
                            title="Use as target"
                          >
                            [set T]
                          </button>
                        </Show>
                      </div>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          <div class="flex-1 flex flex-col overflow-hidden">
            <Show
              when={selectedSources().size > 0}
              fallback={
                <div class="flex-1 flex items-center justify-center">
                  <span class="text-sm text-[var(--text-muted)]">
                    Select a source file to pick fields
                  </span>
                </div>
              }
            >
              <div class="flex items-center border-b border-[var(--border-subtle)] overflow-x-auto">
                <For each={Array.from(selectedSources().keys())}>
                  {(key) => (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSource(key);
                        setActivePath([]);
                      }}
                      class={`px-4 py-2 text-xs border-r border-[var(--border-subtle)] flex items-center gap-2 shrink-0 ${
                        activeSource() === key && activePath().length === 0
                          ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                      }`}
                    >
                      <span class="truncate max-w-28">
                        {key.split("/").pop()}
                      </span>
                      <span
                        class="text-[var(--text-muted)] hover:text-[var(--error)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSource(key);
                        }}
                      >
                        ×
                      </span>
                    </button>
                  )}
                </For>
                <Show when={activePath().length > 0}>
                  <div class="flex items-center px-2 py-1 bg-[var(--bg-tertiary)] overflow-x-auto">
                    <For each={breadcrumbs()}>
                      {(item, index) => (
                        <>
                          <Show when={index() > 0}>
                            <span class="text-[var(--text-muted)] mx-1">/</span>
                          </Show>
                          <button
                            type="button"
                            onClick={() => handleBreadcrumbClick(index())}
                            class={`text-xs px-1 rounded hover:bg-[var(--bg-elevated)] ${
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
                </Show>
              </div>

              <div class="flex-1 overflow-y-auto p-4">
                <Show when={activeSourceData()}>
                  <div class="space-y-1">
                    <div class="flex items-center justify-between mb-3">
                      <span class="text-xs text-[var(--text-muted)]">
                        {activePath().length === 0
                          ? "TOP-LEVEL FIELDS"
                          : `FIELDS IN "${activePath()[activePath().length - 1]}"`}
                      </span>
                      <span class="text-xs text-[var(--text-muted)]">
                        {
                          selectedFields().filter(
                            (f) => f.sourceFile === activeSource(),
                          ).length
                        }{" "}
                        selected
                      </span>
                    </div>
                    <For each={activeSourceEntries()}>
                      {(entry) => {
                        const isSelected = () => isFieldSelected(entry.key);
                        const hasConflict = () =>
                          targetData() &&
                          isObject(targetData()) &&
                          entry.key in (targetData() as JsonObject);
                        const selectedField = () => getSelectedField(entry.key);

                        return (
                          <div
                            class={`flex items-center gap-3 p-2 rounded border transition-colors ${
                              isSelected()
                                ? "bg-[var(--accent-subtle)] border-[var(--accent)]"
                                : "hover:bg-[var(--bg-tertiary)] border-transparent hover:border-[var(--border-subtle)]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected()}
                              onChange={() =>
                                handleToggleField(entry.key, entry.value)
                              }
                              class="w-4 h-4 accent-[var(--accent)]"
                            />
                            <span
                              class={`text-sm min-w-[120px] ${hasConflict() ? "text-[var(--warning)]" : "text-yellow-400"}`}
                            >
                              {entry.key}
                            </span>
                            <span class="text-xs text-[var(--text-muted)] min-w-[100px]">
                              {getValuePreview(entry.value)}
                            </span>
                            <Show when={entry.isExpandable && !isSelected()}>
                              <button
                                type="button"
                                onClick={() => handleDrillDown(entry.key)}
                                class="text-xs text-[var(--accent)] hover:underline"
                              >
                                [drill]
                              </button>
                            </Show>
                            <Show when={isSelected()}>
                              <input
                                type="text"
                                value={selectedField()?.selectedKey || ""}
                                onInput={(e) =>
                                  handleRenameField(
                                    [...activePath(), entry.key],
                                    e.currentTarget.value,
                                  )
                                }
                                class="text-sm bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded px-2 py-1 flex-1 max-w-[200px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                placeholder="Rename"
                              />
                            </Show>
                          </div>
                        );
                      }}
                    </For>
                    <Show when={activeSourceEntries().length === 0}>
                      <p class="text-xs text-[var(--text-muted)] text-center py-4">
                        {isArray(activeSourceData())
                          ? "Empty array"
                          : "No fields available"}
                      </p>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>

        <div class="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <Show when={mode() === "create"}>
                <span class="text-xs text-[var(--text-muted)]">NEW FILE:</span>
                <input
                  type="text"
                  value={newFileName()}
                  onInput={(e) => setNewFileName(e.currentTarget.value)}
                  placeholder="entry.json"
                  class="text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded px-3 py-1.5 w-64 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </Show>
              <Show when={mode() === "add"}>
                <span class="text-xs text-[var(--text-muted)]">
                  {targetData()
                    ? isArray(targetData())
                      ? `Will append new entry with ${selectedFields().length} field${selectedFields().length !== 1 ? "s" : ""} to ${targetFile()?.split("/").pop()}`
                      : `Will add ${selectedFields().length} field${selectedFields().length !== 1 ? "s" : ""} to ${targetFile()?.split("/").pop()}`
                    : "Select a target file from the left panel"}
                </span>
              </Show>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onClick={props.onClose}
                class="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={
                  creating() ||
                  selectedFields().length === 0 ||
                  (mode() === "add" && !targetFile())
                }
                class="btn-primary text-xs"
              >
                {creating()
                  ? "Saving..."
                  : mode() === "create"
                    ? "Create"
                    : "Add Fields"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
