import { createSignal, Show } from "solid-js";
import { serverGetJsonFile, serverPutJsonFile } from "~/lib/r2-server";
import R2Config from "~/components/R2Config";
import FileBrowser from "~/components/FileBrowser";
import JsonTreeView from "~/components/JsonTreeView";
import JsonTableView from "~/components/JsonTableView";
import PreviewPane from "~/components/PreviewPane";

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file");
    } finally {
      setLoading(false);
    }
  };
  
  const handleDataChange = (_path: string[], newData: unknown) => {
    setJsonData(newData);
  };
  
  const handleSave = async () => {
    if (!selectedFile() || !jsonData()) return;
    
    setSaving(true);
    setError("");
    setSuccess("");
    
    try {
      await serverPutJsonFile(selectedFile()!, jsonData());
      setOriginalData(JSON.parse(JSON.stringify(jsonData())));
      setSuccess("Saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
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
    <div class="min-h-screen bg-[var(--bg-primary)] pt-14">
      <div class="fixed inset-0 pointer-events-none overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--accent-subtle)_0%,transparent_50%)] opacity-30"></div>
      </div>
      
      <div class="relative z-10 p-4 max-w-[1920px] mx-auto">
        <R2Config onConnected={handleConnected} />
        
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div class="lg:col-span-1 min-h-[500px]">
            <FileBrowser
              key={refreshKey()}
              selectedFile={selectedFile()}
              onFileSelect={handleFileSelect}
              refreshTrigger={refreshKey()}
            />
          </div>
          
          <div class="lg:col-span-4">
            <Show when={!selectedFile()}>
              <div class="glass-elevated rounded-lg p-12 text-center min-h-[500px] flex flex-col items-center justify-center">
                <div class="led led-amber mb-4"></div>
                <p class="font-mono text-sm text-[var(--text-muted)] tracking-wide">SELECT A FILE TO BEGIN</p>
              </div>
            </Show>
            
            <Show when={selectedFile()}>
              <div class="glass-elevated rounded-lg overflow-hidden">
                <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="font-mono text-xs text-[var(--accent)]">▸</span>
                    <h2 class="font-mono text-sm text-[var(--text-primary)] truncate">{selectedFile()?.split("/").pop()}</h2>
                    <Show when={hasChanges()}>
                      <span class="text-[var(--warning)] font-mono text-xs blink">●</span>
                    </Show>
                  </div>
                  
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setViewMode("tree")}
                      class={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                        viewMode() === "tree"
                          ? "bg-[var(--accent)] text-black"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                      }`}
                    >
                      TREE
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("table")}
                      class={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                        viewMode() === "table"
                          ? "bg-[var(--accent)] text-black"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                      }`}
                    >
                      TABLE
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("preview")}
                      class={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                        viewMode() === "preview"
                          ? "bg-[var(--accent)] text-black"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                      }`}
                    >
                      PREVIEW
                    </button>
                  </div>
                </div>
                
                <Show when={error()}>
                  <div class="flex items-center gap-2 px-4 py-3 bg-[rgba(239,68,68,0.1)] border-b border-[var(--error)]">
                    <span class="led led-red"></span>
                    <span class="text-[var(--error)] font-mono text-xs">{error()}</span>
                  </div>
                </Show>
                
                <Show when={success()}>
                  <div class="flex items-center gap-2 px-4 py-3 bg-[rgba(34,197,94,0.1)] border-b border-[var(--success)]">
                    <span class="led led-green"></span>
                    <span class="text-[var(--success)] font-mono text-xs">{success()}</span>
                  </div>
                </Show>
                
                <Show when={loading()}>
                  <div class="flex items-center justify-center gap-3 py-16">
                    <div class="led led-amber led-pulse"></div>
                    <span class="font-mono text-sm text-[var(--text-muted)]">LOADING...</span>
                  </div>
                </Show>
                
                <Show when={!loading() && jsonData()}>
                  <div class="h-[calc(100vh-380px)] overflow-auto p-4">
                    <Show when={viewMode() === "tree"}>
                      <JsonTreeView data={jsonData()!} onChange={handleDataChange} />
                    </Show>
                    <Show when={viewMode() === "table"}>
                      <JsonTableView data={jsonData()!} onChange={handleDataChange} />
                    </Show>
                    <Show when={viewMode() === "preview"}>
                      <PreviewPane data={jsonData()!} />
                    </Show>
                  </div>
                </Show>
                
                <div class="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                  <div class="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving() || !hasChanges()}
                      class="btn-primary font-mono text-xs tracking-wide"
                    >
                      {saving() ? "SAVING..." : "SAVE TO R2"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={!jsonData()}
                      class="btn-secondary font-mono text-xs"
                    >
                      DOWNLOAD
                    </button>
                  </div>
                  <div class="font-mono text-xs text-[var(--text-muted)]">
                    {hasChanges() ? "UNSAVED CHANGES" : "ALL CHANGES SAVED"}
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
