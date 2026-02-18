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
    <div class="bg-slate-800 rounded-lg p-4 mb-4">
      <button
        type="button"
        class="flex items-center justify-between w-full text-white font-medium"
        onClick={() => setExpanded(!expanded())}
      >
        <span>R2 Configuration</span>
        <span class="text-sm">
          {isConnected() ? (
            <span class="text-green-400">Connected</span>
          ) : (
            <span class="text-yellow-400">Not connected</span>
          )}
        </span>
      </button>
      
      <Show when={expanded()}>
        <div class="mt-4 space-y-3">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Endpoint URL</label>
            <input
              type="text"
              value={endpoint()}
              onInput={(e) => setEndpoint(e.currentTarget.value)}
              placeholder="https://xxx.r2.cloudflarestorage.com"
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-sky-500"
            />
          </div>
          
          <div>
            <label class="block text-sm text-gray-400 mb-1">Access Key ID</label>
            <input
              type="text"
              value={accessKeyId()}
              onInput={(e) => setAccessKeyId(e.currentTarget.value)}
              placeholder="Access Key ID"
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-sky-500"
            />
          </div>
          
          <div>
            <label class="block text-sm text-gray-400 mb-1">Secret Access Key</label>
            <input
              type="password"
              value={secretAccessKey()}
              onInput={(e) => setSecretAccessKey(e.currentTarget.value)}
              placeholder="Secret Access Key"
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-sky-500"
            />
          </div>
          
          <div>
            <label class="block text-sm text-gray-400 mb-1">Bucket Name</label>
            <input
              type="text"
              value={bucketName()}
              onInput={(e) => setBucketName(e.currentTarget.value)}
              placeholder="my-bucket"
              class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-sky-500"
            />
          </div>
          
          <Show when={error()}>
            <p class="text-red-400 text-sm">{error()}</p>
          </Show>
          
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading() || !endpoint() || !accessKeyId() || !secretAccessKey() || !bucketName()}
            class="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
          >
            {loading() ? "Connecting..." : "Connect"}
          </button>
        </div>
      </Show>
    </div>
  );
}
