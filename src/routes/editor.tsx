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
    <div class="min-h-screen bg-slate-900 p-4">
      <R2Config onConnected={handleConnected} />
      
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div class="lg:col-span-1">
          <FileBrowser
            key={refreshKey()}
            selectedFile={selectedFile()}
            onFileSelect={handleFileSelect}
            refreshTrigger={refreshKey()}
          />
        </div>
        
        <div class="lg:col-span-3">
          <Show when={!selectedFile()}>
            <div class="bg-slate-800 rounded-lg p-8 text-center">
              <p class="text-gray-400">Select a JSON file to edit</p>
            </div>
          </Show>
          
          <Show when={selectedFile()}>
            <div class="bg-slate-800 rounded-lg p-4">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                  <h2 class="text-white font-medium truncate">{selectedFile()}</h2>
                  <Show when={hasChanges()}>
                    <span class="text-yellow-400 text-sm">(modified)</span>
                  </Show>
                </div>
                
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode("tree")}
                    class={`px-3 py-1 rounded text-sm ${
                      viewMode() === "tree"
                        ? "bg-sky-600 text-white"
                        : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                    }`}
                  >
                    Tree
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    class={`px-3 py-1 rounded text-sm ${
                      viewMode() === "table"
                        ? "bg-sky-600 text-white"
                        : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                    }`}
                  >
                    Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("preview")}
                    class={`px-3 py-1 rounded text-sm ${
                      viewMode() === "preview"
                        ? "bg-sky-600 text-white"
                        : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>
              
              <Show when={error()}>
                <div class="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded mb-4">
                  {error()}
                </div>
              </Show>
              
              <Show when={success()}>
                <div class="bg-green-900/50 border border-green-700 text-green-200 px-4 py-2 rounded mb-4">
                  {success()}
                </div>
              </Show>
              
              <Show when={loading()}>
                <div class="text-center py-8 text-gray-400">Loading...</div>
              </Show>
              
              <Show when={!loading() && jsonData()}>
                <div class="h-[calc(100vh-320px)] overflow-auto">
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
              
              <div class="flex items-center gap-3 mt-4 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving() || !hasChanges()}
                  class="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
                >
                  {saving() ? "Saving..." : "Save to R2"}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!jsonData()}
                  class="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
                >
                  Download
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
