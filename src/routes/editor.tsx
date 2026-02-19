import { createSignal, Show, For } from "solid-js";
import { serverGetJsonFile, serverPutJsonFile } from "~/lib/r2-server";
import { detectAndValidate, clearTemplateState, templateStore, type BlockMode } from "~/stores/template-store";
import R2Config from "~/components/R2Config";
import FileBrowser from "~/components/FileBrowser";
import JsonTreeView from "~/components/JsonTreeView";
import JsonTableView from "~/components/JsonTableView";
import PreviewPane from "~/components/PreviewPane";
import TemplatePicker from "~/components/TemplatePicker";
import NestedViewModal from "~/components/NestedViewModal";

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
  const [templatePickerExistingKey, setTemplatePickerExistingKey] = createSignal<string | null>(null);
  const [templatePickerExistingData, setTemplatePickerExistingData] = createSignal<Record<string, unknown> | null>(null);
  const [nestedViewPath, setNestedViewPath] = createSignal<string[] | null>(null);
  const [showViolations, setShowViolations] = createSignal(false);
  
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
      detectAndValidate(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file");
    } finally {
      setLoading(false);
    }
  };
  const handleDataChange = (_path: string[], newData: unknown) => {
    setJsonData(newData);
    detectAndValidate(newData);
  };
  
  const handleNodeClick = (path: string[], _value: unknown) => {
    setNestedViewPath(path);
  };
  
  const handleNestedSave = (path: string[], newData: unknown) => {
    const updateAtPath = (obj: unknown, p: string[], value: unknown): unknown => {
      if (p.length === 0) return value;
      
      const newObj = Array.isArray(obj) ? [...obj] : { ...(obj as Record<string, unknown>) };
      const [first, ...rest] = p;
      
      if (rest.length === 0) {
        (newObj as Record<string, unknown>)[first] = value;
      } else {
        (newObj as Record<string, unknown>)[first] = updateAtPath(
          (newObj as Record<string, unknown>)[first],
          rest,
          value
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
    setRefreshKey(k => k + 1);
    handleFileSelect(key);
  };
  
  const handleAddFromTemplate = () => {
    if (selectedFile() && jsonData() && typeof jsonData() === "object" && !Array.isArray(jsonData())) {
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
    
    const blob = new Blob([JSON.stringify(jsonData(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile()?.split("/").pop() || "data.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleConnected = () => {
    setRefreshKey(k => k + 1);
  };
  
  return (
    <div class="min-h-screen bg-[var(--bg-primary)] p-3 max-w-5xl mx-auto">
      <R2Config onConnected={handleConnected} />
      
      <Show when={!selectedFile()}>
        <div class="card p-6 text-center">
          <p class="text-sm text-[var(--text-muted)]">Select a file to begin</p>
        </div>
      </Show>
      
      <Show when={selectedFile()}>
        <div class="card overflow-hidden">
          <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
            <div class="flex items-center gap-3 min-w-0">
              <span class="text-sm text-[var(--text-primary)] truncate">{selectedFile()?.split("/").pop()}</span>
              <Show when={hasChanges()}>
                <span class="text-xs text-[var(--warning)]">●</span>
              </Show>
              <Show when={templateStore.templateDetected()}>
                <button
                  type="button"
                  onClick={() => setShowViolations(!showViolations())}
                  class={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                    templateStore.validationResult().isValid
                      ? "bg-[rgba(16,185,129,0.1)] text-[var(--success)] hover:bg-[rgba(16,185,129,0.2)]"
                      : "bg-[rgba(239,68,68,0.1)] text-[var(--error)] hover:bg-[rgba(239,68,68,0.2)]"
                  }`}
                >
                  <span class={templateStore.validationResult().isValid ? "●" : "●"}
                  >{templateStore.validationResult().isValid ? "Valid" : `${templateStore.errorCount()} issues`}</span>
                </button>
                <select
                  value={templateStore.blockMode()}
                  onChange={(e) => templateStore.setBlockMode(e.currentTarget.value as BlockMode)}
                  class="text-xs bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded px-2 py-0.5 text-[var(--text-secondary)] focus:outline-none"
                >
                  <option value="warn">Warn</option>
                  <option value="block">Block</option>
                </select>
              </Show>
            </div>
            
            <div class="flex items-center gap-0.5 p-0.5 bg-[var(--bg-tertiary)] rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode("tree")}
                class={`px-2 py-1 rounded text-xs transition-colors ${
                  viewMode() === "tree"
                    ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                Tree
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                class={`px-2 py-1 rounded text-xs transition-colors ${
                  viewMode() === "table"
                    ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                class={`px-2 py-1 rounded text-xs transition-colors ${
                  viewMode() === "preview"
                    ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                Raw
              </button>
            </div>
          </div>
          
          <Show when={error()}>
            <div class="px-4 py-2 bg-[rgba(239,68,68,0.1)] border-b border-[var(--border-subtle)]">
              <span class="text-xs text-[var(--error)]">{error()}</span>
            </div>
          </Show>
          
          <Show when={success()}>
            <div class="px-4 py-2 bg-[rgba(16,185,129,0.1)] border-b border-[var(--border-subtle)]">
              <span class="text-xs text-[var(--success)]">{success()}</span>
            </div>
          </Show>
          
          <Show when={showViolations() && templateStore.templateDetected() && !templateStore.validationResult().isValid}>
            <div class="max-h-48 overflow-y-auto border-b border-[var(--border-subtle)] bg-[rgba(239,68,68,0.05)]">
              <div class="px-4 py-2">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-medium text-[var(--error)]">TEMPLATE VIOLATIONS</span>
                  <button
                    type="button"
                    onClick={() => setShowViolations(false)}
                    class="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    ×
                  </button>
                </div>
                <div class="space-y-1">
                  <For each={templateStore.validationResult().violations}>
                    {(violation) => (
                      <div class="flex items-start gap-2 text-xs">
                        <span class="text-[var(--text-muted)]">[{violation.index}]</span>
                        <span class={`${violation.severity === "error" ? "text-[var(--error)]" : "text-[var(--warning)]"}`}>
                          {violation.path ? `${violation.path}: ` : ""}{violation.message}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </Show>
          
          <Show when={loading()}>
            <div class="flex items-center justify-center gap-2 py-12">
              <span class="status-dot status-dot-amber animate-pulse"></span>
              <span class="text-sm text-[var(--text-muted)]">Loading...</span>
            </div>
          </Show>
          
          <Show when={!loading() && jsonData()}>
            <div class="h-[50vh] overflow-auto p-3">
              <Show when={viewMode() === "tree"}>
                <JsonTreeView data={jsonData()!} onChange={handleDataChange} onNodeClick={handleNodeClick} />
              </Show>
              <Show when={viewMode() === "table"}>
                <JsonTableView data={jsonData()!} onChange={handleDataChange} onNodeClick={handleNodeClick} />
              </Show>
              <Show when={viewMode() === "preview"}>
                <PreviewPane data={jsonData()!} />
              </Show>
            </div>
          </Show>
          
          <div class="flex items-center justify-between px-3 py-2 border-t border-[var(--border-subtle)]">
            <div class="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving() || !hasChanges() || !templateStore.canSave()}
                class={`btn-primary text-xs ${!templateStore.canSave() ? "opacity-50" : ""}`}
              >
                {saving() ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!jsonData()}
                class="btn-secondary text-xs"
              >
                Download
              </button>
              <button
                type="button"
                onClick={handleAddFromTemplate}
                disabled={!jsonData()}
                class="btn-ghost text-xs"
              >
                + Template
              </button>
            </div>
            <div class="text-xs text-[var(--text-muted)]">
              <Show when={!templateStore.canSave()}>
                <span class="text-[var(--error)]">Template violations - </span>
              </Show>
              {hasChanges() ? "Unsaved changes" : "All changes saved"}
            </div>
          </div>
        </div>
      </Show>

      <div class="mt-3">
        <FileBrowser
          selectedFile={selectedFile()}
          onFileSelect={handleFileSelect}
          refreshTrigger={refreshKey()}
          onCreateFromTemplate={() => setShowTemplatePicker(true)}
        />
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
