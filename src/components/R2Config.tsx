import { createSignal, Show, onMount } from "solid-js";
import { serverInitR2, serverIsConfigured } from "~/lib/r2-server";
import type { R2Config } from "~/lib/r2";

interface Props {
  onConnected: () => void;
}

export default function R2Config(props: Props) {
  const [showConfig, setShowConfig] = createSignal(false);
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
      setShowConfig(false);
      
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
    <div class="mb-4">
      <Show when={isConnected() && !showConfig()}>
        <div class="flex items-center justify-between card px-3 py-2">
          <div class="flex items-center gap-2">
            <span class="status-dot status-dot-success"></span>
            <span class="text-sm text-[var(--text-secondary)]">{bucketName()}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowConfig(true)}
            class="btn-ghost text-xs"
          >
            Configure
          </button>
        </div>
      </Show>

      <Show when={!isConnected() || showConfig()}>
        <div class="card p-3">
          <Show when={isConnected()}>
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-medium">Connection Settings</span>
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                class="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none"
              >
                ×
              </button>
            </div>
          </Show>
          
          <div class="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={endpoint()}
              onInput={(e) => setEndpoint(e.currentTarget.value)}
              placeholder="Endpoint"
              class="input text-sm"
            />
            <input
              type="text"
              value={bucketName()}
              onInput={(e) => setBucketName(e.currentTarget.value)}
              placeholder="Bucket"
              class="input text-sm"
            />
            <input
              type="text"
              value={accessKeyId()}
              onInput={(e) => setAccessKeyId(e.currentTarget.value)}
              placeholder="Access Key"
              class="input text-sm col-span-2"
            />
            <input
              type="password"
              value={secretAccessKey()}
              onInput={(e) => setSecretAccessKey(e.currentTarget.value)}
              placeholder="Secret Key"
              class="input text-sm col-span-2"
            />
          </div>
          
          <Show when={error()}>
            <div class="mt-2 text-xs text-[var(--error)]">{error()}</div>
          </Show>
          
          <div class="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleConnect}
              disabled={loading() || !endpoint() || !accessKeyId() || !secretAccessKey() || !bucketName()}
              class="btn-primary text-sm"
            >
              {loading() ? "Connecting..." : "Connect"}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
