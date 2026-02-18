import { createSignal, Show, onMount } from "solid-js";
import { serverInitR2, serverIsConfigured } from "~/lib/r2-server";
import type { R2Config } from "~/lib/r2";

interface Props {
  onConnected: () => void;
}

export default function R2Config(props: Props) {
  const [expanded, setExpanded] = createSignal(true);
  const [endpoint, setEndpoint] = createSignal("");
  const [accessKeyId, setAccessKeyId] = createSignal("");
  const [secretAccessKey, setSecretAccessKey] = createSignal("");
  const [bucketName, setBucketName] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [isConnected, setIsConnected] = createSignal(false);

  onMount(async () => {
    if (typeof window !== "undefined") {
      setEndpoint(localStorage.getItem("r2_endpoint") || "");
      setAccessKeyId(localStorage.getItem("r2_access_key_id") || "");
      setSecretAccessKey(localStorage.getItem("r2_secret_access_key") || "");
      setBucketName(localStorage.getItem("r2_bucket_name") || "");
      
      try {
        const configured = await serverIsConfigured();
        setIsConnected(configured);
        if (configured) {
          props.onConnected();
        }
      } catch (e) {
        console.error("Failed to check R2 status:", e);
      }
    }
  });

  const handleConnect = async () => {
    setError("");
    setLoading(true);
    
    try {
      const config: R2Config = {
        endpoint: endpoint(),
        accessKeyId: accessKeyId(),
        secretAccessKey: secretAccessKey(),
        bucketName: bucketName(),
      };

      await serverInitR2(config);
      setIsConnected(true);
      
      if (typeof window !== "undefined") {
        localStorage.setItem("r2_endpoint", endpoint());
        localStorage.setItem("r2_access_key_id", accessKeyId());
        localStorage.setItem("r2_secret_access_key", secretAccessKey());
        localStorage.setItem("r2_bucket_name", bucketName());
      }
      
      props.onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="glass-elevated rounded-lg overflow-hidden">
      <button
        type="button"
        class="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-[var(--bg-elevated)] transition-colors"
        onClick={() => setExpanded(!expanded())}
      >
        <div class="flex items-center gap-3">
          <div class={`led ${isConnected() ? "led-green led-pulse" : "led-amber"}`}></div>
          <span class="font-mono text-sm tracking-wider">R2 CONFIG</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-mono text-xs text-[var(--text-muted)]">
            {isConnected() ? bucketName() : "NOT CONNECTED"}
          </span>
          <svg 
            class={`w-4 h-4 text-[var(--text-muted)] transition-transform ${expanded() ? "rotate-180" : ""}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      <Show when={expanded()}>
        <div class="px-4 pb-4 border-t border-[var(--border-subtle)]">
          <div class="pt-4 space-y-3">
            <div>
              <label class="block font-mono text-xs text-[var(--text-muted)] mb-1.5 tracking-wide">ENDPOINT</label>
              <input
                type="text"
                value={endpoint()}
                onInput={(e) => setEndpoint(e.currentTarget.value)}
                placeholder="https://xxx.r2.cloudflarestorage.com"
                class="input font-mono text-sm"
              />
            </div>
            
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-mono text-xs text-[var(--text-muted)] mb-1.5 tracking-wide">ACCESS KEY</label>
                <input
                  type="text"
                  value={accessKeyId()}
                  onInput={(e) => setAccessKeyId(e.currentTarget.value)}
                  placeholder="AKIA..."
                  class="input font-mono text-sm"
                />
              </div>
              
              <div>
                <label class="block font-mono text-xs text-[var(--text-muted)] mb-1.5 tracking-wide">SECRET KEY</label>
                <input
                  type="password"
                  value={secretAccessKey()}
                  onInput={(e) => setSecretAccessKey(e.currentTarget.value)}
                  placeholder="••••••••"
                  class="input font-mono text-sm"
                />
              </div>
            </div>
            
            <div>
              <label class="block font-mono text-xs text-[var(--text-muted)] mb-1.5 tracking-wide">BUCKET</label>
              <input
                type="text"
                value={bucketName()}
                onInput={(e) => setBucketName(e.currentTarget.value)}
                placeholder="my-bucket"
                class="input font-mono text-sm"
              />
            </div>
            
            <Show when={error()}>
              <div class="flex items-center gap-2 text-[var(--error)] text-sm font-mono">
                <span class="led led-red"></span>
                {error()}
              </div>
            </Show>
            
            <button
              type="button"
              onClick={handleConnect}
              disabled={loading() || !endpoint() || !accessKeyId() || !secretAccessKey() || !bucketName()}
              class="btn-primary w-full font-mono text-sm tracking-wide"
            >
              {loading() ? "INITIALIZING..." : "ESTABLISH CONNECTION"}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
