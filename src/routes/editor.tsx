import { createSignal, Show, For, onMount } from "solid-js";
import {
  serverGetJsonFile,
  serverPutJsonFile,
  serverListJsonFiles,
} from "~/lib/r2-server";
import {
  detectAndValidate,
  templateStore,
  type BlockMode,
} from "~/stores/template-store";
import R2Config from "~/components/R2Config";
import Sidebar from "~/components/Sidebar";
import JsonTreeView from "~/components/JsonTreeView";
import JsonTableView from "~/components/JsonTableView";
import PreviewPane from "~/components/PreviewPane";
import TemplatePicker from "~/components/TemplatePicker";
import NestedViewModal from "~/components/NestedViewModal";
import Nav from "~/components/Nav";
import { JsonValue } from "~/lib/template-detector";

type ViewMode = "tree" | "table" | "preview";

export default function Editor() {
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [jsonData, setJsonData] = createSignal<unknown>(null);
  const [originalData, setOriginalData] = createSignal<unknown>(null);
  const [loading, setLoading] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal("");
  const [viewMode, setViewMode] = createSignal<ViewMode>("tree");
  const [refreshKey, setRefreshKey] = createSignal(0);
  const [showTemplatePicker, setShowTemplatePicker] = createSignal(false);
  const [templatePickerExistingKey, setTemplatePickerExistingKey] =
    createSignal<string | null>(null);
  const [templatePickerExistingData, setTemplatePickerExistingData] =
    createSignal<Record<string, unknown> | null>(null);
  const [nestedViewPath, setNestedViewPath] = createSignal<string[] | null>(
    null,
  );
  const [showViolations, setShowViolations] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  const [isConfigured, setIsConfigured] = createSignal(false);

  onMount(async () => {
    const configured = await fetch("/api/r2/is-configured").then((r) =>
      r.json(),
    );
    setIsConfigured(configured);
  });

  const hasChanges = () => {
    return JSON.stringify(jsonData()) !== JSON.stringify(originalData());
  };

  const handleFileSelect = async (key: string) => {
    if (hasChanges()) {
      if (!confirm("You have unsaved changes. Discard them?")) {
        return;
      }
    }

    setLoading(true);
    setError("");
    setSelectedFile(key);

    try {
      const data = await serverGetJsonFile(key);
      setJsonData(data);
      setOriginalData(JSON.parse(JSON.stringify(data)));
      detectAndValidate(data as JsonValue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file");
    } finally {
      setLoading(false);
    }
  };

  const handleDataChange = (_path: string[], newData: unknown) => {
    setJsonData(newData);
    detectAndValidate(newData as JsonValue);
  };

  const handleNodeClick = (path: string[], _value: unknown) => {
    setNestedViewPath(path);
  };

  const handleNestedSave = (path: string[], newData: unknown) => {
    const updateAtPath = (
      obj: unknown,
      p: string[],
      value: unknown,
    ): unknown => {
      if (p.length === 0) return value;

      const newObj = Array.isArray(obj)
        ? [...obj]
        : { ...(obj as Record<string, unknown>) };
      const [first, ...rest] = p;

      if (rest.length === 0) {
        (newObj as Record<string, unknown>)[first] = value;
      } else {
        (newObj as Record<string, unknown>)[first] = updateAtPath(
          (newObj as Record<string, unknown>)[first],
          rest,
          value,
        );
      }

      return newObj;
    };

    const updated = updateAtPath(jsonData(), path, newData);
    setJsonData(updated);
  };

  const handleNestedDrillDown = (path: string[]) => {
    setNestedViewPath(path);
  };

  const handleTemplateCreated = (key: string) => {
    setShowTemplatePicker(false);
    setTemplatePickerExistingKey(null);
    setTemplatePickerExistingData(null);
    setRefreshKey((k) => k + 1);
    handleFileSelect(key);
  };

  const handleAddFromTemplate = () => {
    if (
      selectedFile() &&
      jsonData() &&
      typeof jsonData() === "object" &&
      !Array.isArray(jsonData())
    ) {
      setTemplatePickerExistingKey(selectedFile());
      setTemplatePickerExistingData(jsonData() as Record<string, unknown>);
    }
    setShowTemplatePicker(true);
  };

  const handleSave = async () => {
    if (!selectedFile() || !jsonData()) return;

    if (!templateStore.canSave()) {
      setError("Cannot save: template violations must be resolved");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await serverPutJsonFile(selectedFile()!, jsonData());
      setOriginalData(JSON.parse(JSON.stringify(jsonData())));
      setSuccess("Saved");
      setTimeout(() => setSuccess(""), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!jsonData()) return;

    const blob = new Blob([JSON.stringify(jsonData(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile()?.split("/").pop() || "data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConnected = () => {
    setIsConfigured(true);
    setRefreshKey((k) => k + 1);
  };

  const filePathParts = () => {
    if (!selectedFile()) return [];
    return selectedFile()!.split("/").filter(Boolean);
  };

  const viewModeButtons = [
    {
      mode: "tree" as ViewMode,
      label: "Tree",
      icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
    },
    {
      mode: "table" as ViewMode,
      label: "Table",
      icon: "M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
    },
    {
      mode: "preview" as ViewMode,
      label: "Raw",
      icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    },
  ];

  return (
    <div class="h-screen flex flex-col bg-[var(--bg-primary)]">
      <Nav onConnected={handleConnected} />

      <div class="flex-1 flex overflow-hidden">
        <Show when={isConfigured()}>
          <Show when={sidebarOpen()}>
            <aside class="w-[var(--sidebar-width)] shrink-0 animate-slide-in">
              <Sidebar
                selectedFile={selectedFile()}
                onFileSelect={handleFileSelect}
                refreshTrigger={refreshKey()}
                onCreateFromTemplate={() => setShowTemplatePicker(true)}
              />
            </aside>
          </Show>
        </Show>

        <main class="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Show when={!isConfigured()}>
            <div class="flex-1 flex items-center justify-center p-8">
              <div class="w-full max-w-md">
                <R2Config onConnected={handleConnected} />
              </div>
            </div>
          </Show>

          <Show when={isConfigured()}>
            <Show when={!selectedFile()}>
              <div class="flex-1 flex items-center justify-center">
                <div class="text-center">
                  <svg
                    class="mx-auto w-12 h-12 text-[var(--text-muted)] mb-4 opacity-50"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                  </svg>
                  <p class="text-sm text-[var(--text-muted)]">
                    Select a file from the sidebar to begin
                  </p>
                </div>
              </div>
            </Show>

            <Show when={selectedFile()}>
              <div class="flex-1 flex flex-col min-h-0">
                <div class="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                  <div class="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(!sidebarOpen())}
                      class="btn-icon"
                      title={sidebarOpen() ? "Hide sidebar" : "Show sidebar"}
                    >
                      {sidebarOpen() ? (
                        <svg
                          class="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                          />
                        </svg>
                      ) : (
                        <svg
                          class="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M13 5l7 7-7 7M5 5l7 7-7 7"
                          />
                        </svg>
                      )}
                    </button>

                    <div class="flex items-center gap-1 min-w-0">
                      <For each={filePathParts()}>
                        {(part, index) => (
                          <>
                            <span
                              class={`text-sm truncate ${index() === filePathParts().length - 1 ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-muted)]"}`}
                            >
                              {part}
                            </span>
                            <Show when={index() < filePathParts().length - 1}>
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
                            </Show>
                          </>
                        )}
                      </For>
                    </div>

                    <Show when={hasChanges()}>
                      <span class="w-2 h-2 rounded-full bg-[var(--warning)] animate-pulse shrink-0" />
                    </Show>

                    <Show when={templateStore.templateDetected()}>
                      <button
                        type="button"
                        onClick={() => setShowViolations(!showViolations())}
                        class={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          templateStore.validationResult().isValid
                            ? "bg-[var(--success-subtle)] text-[var(--success)] hover:bg-[var(--success-subtle)]"
                            : "bg-[var(--error-subtle)] text-[var(--error)] hover:bg-[var(--error-subtle)]"
                        }`}
                      >
                        {templateStore.validationResult().isValid ? (
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
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        ) : (
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
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                        )}
                        {templateStore.validationResult().isValid
                          ? "Valid"
                          : `${templateStore.errorCount()} issues`}
                      </button>
                      <select
                        value={templateStore.blockMode()}
                        onChange={(e) =>
                          templateStore.setBlockMode(
                            e.currentTarget.value as BlockMode,
                          )
                        }
                        class="input input-sm bg-[var(--bg-tertiary)] text-xs py-1"
                      >
                        <option value="warn">Warn</option>
                        <option value="block">Block</option>
                      </select>
                    </Show>
                  </div>

                  <div class="flex items-center gap-1 p-0.5 bg-[var(--bg-tertiary)] rounded-lg">
                    <For each={viewModeButtons}>
                      {({ mode, label, icon }) => (
                        <button
                          type="button"
                          onClick={() => setViewMode(mode)}
                          class={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                            viewMode() === mode
                              ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          }`}
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
                              d={icon}
                            />
                          </svg>
                          {label}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                <Show
                  when={
                    showViolations() &&
                    templateStore.templateDetected() &&
                    !templateStore.validationResult().isValid
                  }
                >
                  <div class="max-h-40 overflow-y-auto border-b border-[var(--border-subtle)] bg-[var(--error-subtle)]">
                    <div class="px-4 py-3">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-semibold text-[var(--error)] uppercase tracking-wider">
                          Template Violations
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowViolations(false)}
                          class="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          ×
                        </button>
                      </div>
                      <div class="space-y-1.5">
                        <For each={templateStore.validationResult().violations}>
                          {(violation) => (
                            <div class="flex items-start gap-2 text-xs">
                              <span class="text-[var(--text-muted)] shrink-0">
                                [{violation.index}]
                              </span>
                              <span
                                class={`${violation.severity === "error" ? "text-[var(--error)]" : "text-[var(--warning)]"}`}
                              >
                                {violation.path ? `${violation.path}: ` : ""}
                                {violation.message}
                              </span>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                </Show>

                <Show when={error()}>
                  <div class="px-4 py-2.5 bg-[var(--error-subtle)] border-b border-[var(--border-subtle)]">
                    <span class="text-sm text-[var(--error)]">{error()}</span>
                  </div>
                </Show>

                <Show when={success()}>
                  <div class="px-4 py-2.5 bg-[var(--success-subtle)] border-b border-[var(--border-subtle)]">
                    <span class="text-sm text-[var(--success)]">
                      {success()}
                    </span>
                  </div>
                </Show>

                <div class="flex-1 overflow-hidden p-4">
                  <Show when={loading()}>
                    <div class="flex items-center justify-center gap-2 py-16">
                      <div class="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                      <span class="text-sm text-[var(--text-muted)]">
                        Loading...
                      </span>
                    </div>
                  </Show>

                  <Show when={!loading() && jsonData()}>
                    <div class="h-full overflow-auto">
                      <Show when={viewMode() === "tree"}>
                        <JsonTreeView
                          data={jsonData()!}
                          onChange={handleDataChange}
                          onNodeClick={handleNodeClick}
                        />
                      </Show>
                      <Show when={viewMode() === "table"}>
                        <JsonTableView
                          data={jsonData()!}
                          onChange={handleDataChange}
                          onNodeClick={handleNodeClick}
                        />
                      </Show>
                      <Show when={viewMode() === "preview"}>
                        <PreviewPane data={jsonData()!} />
                      </Show>
                    </div>
                  </Show>
                </div>

                <div class="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={
                        saving() || !hasChanges() || !templateStore.canSave()
                      }
                      class="btn-primary text-sm"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                        />
                      </svg>
                      {saving() ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={!jsonData()}
                      class="btn-secondary text-sm"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={handleAddFromTemplate}
                      disabled={!jsonData()}
                      class="btn-ghost text-sm"
                    >
                      <svg
                        class="w-4 h-4"
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
                      Template
                    </button>
                  </div>
                  <div class="text-xs text-[var(--text-muted)]">
                    <Show when={!templateStore.canSave()}>
                      <span class="text-[var(--error)]">
                        Template violations —{" "}
                      </span>
                    </Show>
                    {hasChanges() ? "Unsaved changes" : "All changes saved"}
                  </div>
                </div>
              </div>
            </Show>
          </Show>
        </main>
      </div>

      <Show when={showTemplatePicker()}>
        <TemplatePicker
          onClose={() => {
            setShowTemplatePicker(false);
            setTemplatePickerExistingKey(null);
            setTemplatePickerExistingData(null);
          }}
          onCreated={handleTemplateCreated}
          existingFile={templatePickerExistingKey()}
          existingData={templatePickerExistingData() as any}
        />
      </Show>

      <Show when={nestedViewPath() !== null && jsonData()}>
        <NestedViewModal
          data={jsonData()!}
          rootData={jsonData()!}
          basePath={nestedViewPath()!}
          onClose={() => setNestedViewPath(null)}
          onSave={handleNestedSave}
          onDrillDown={handleNestedDrillDown}
        />
      </Show>
    </div>
  );
}
