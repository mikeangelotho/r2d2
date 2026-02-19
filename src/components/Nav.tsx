import { createSignal, onMount, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import { serverIsConfigured } from "~/lib/r2-server";
import { serverLoadOrgs } from "~/lib/orgs-server";
import type { Organization, Bucket } from "~/lib/orgs-server";

interface Props {
  onConnected: () => void;
}

export default function Nav(props: Props) {
  const [connected, setConnected] = createSignal(false);
  const [connecting, setConnecting] = createSignal(false);
  const [orgs, setOrgs] = createSignal<Organization[]>([]);
  const [buckets, setBuckets] = createSignal<Bucket[]>([]);
  const [currentBucketId, setCurrentBucketId] = createSignal<string | null>(
    null,
  );
  const [showBucketMenu, setShowBucketMenu] = createSignal(false);

  onMount(async () => {
    try {
      const configured = await serverIsConfigured();
      setConnected(configured);

      const data = await serverLoadOrgs();
      setOrgs(data.organizations);
      setBuckets(data.buckets);

      const bucketId = localStorage.getItem("r2_bucket_id");
      if (bucketId) {
        setCurrentBucketId(bucketId);
      }
    } catch (e) {
      console.error("Failed to check R2 status:", e);
    }
  });

  const getCurrentBucket = () => {
    const id = currentBucketId();
    if (!id) return null;
    return buckets().find((b) => b.id === id) || null;
  };

  const handleBucketChange = (bucketId: string) => {
    const bucket = buckets().find((b) => b.id === bucketId);
    if (!bucket) return;

    const accessKeyId =
      localStorage.getItem(`r2_access_key_id_${bucket.id}`) || "";
    const secretAccessKey =
      localStorage.getItem(`r2_secret_access_key_${bucket.id}`) || "";

    if (!accessKeyId || !secretAccessKey) {
      alert("Please configure credentials for this bucket in Settings first.");
      return;
    }

    localStorage.setItem("r2_endpoint", bucket.endpoint);
    localStorage.setItem("r2_access_key_id", accessKeyId);
    localStorage.setItem("r2_secret_access_key", secretAccessKey);
    localStorage.setItem("r2_bucket_name", bucket.bucketName);
    localStorage.setItem("r2_bucket_id", bucket.id);
    localStorage.setItem("r2_region", bucket.region);

    setCurrentBucketId(bucketId);
    setShowBucketMenu(false);
    props.onConnected();
  };

  const statusClass = () => {
    if (!connected()) return "bg-[var(--text-muted)]";
    if (connecting()) return "bg-[var(--warning)] animate-pulse";
    return "bg-[var(--success)]";
  };

  return (
    <header class="h-[var(--header-height)] flex items-center justify-between px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm sticky top-0 z-50">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center">
            <svg
              class="w-4 h-4 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
            </svg>
          </div>
          <span class="text-base font-semibold text-[var(--text-primary)] tracking-tight">
            r2d2
          </span>
        </div>

        <Show when={buckets().length > 0}>
          <div class="flex items-center gap-1 text-[var(--text-muted)]">
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>

          <div class="relative">
            <button
              type="button"
              onClick={() => setShowBucketMenu(!showBucketMenu())}
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <svg
                class="w-3.5 h-3.5 text-[var(--accent)]"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M4 4h16v12H5.17L4 17.17V4m0-2c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H4zm2 10h12v2H6v-2zm0-3h12v2H6V9zm0-3h12v2H6V6z" />
              </svg>
              <span class="text-sm text-[var(--text-primary)]">
                {getCurrentBucket()?.name || "Select bucket"}
              </span>
            </button>

            <Show when={showBucketMenu()}>
              <div class="absolute top-full left-0 mt-1 w-48 card-elevated py-1 z-50 animate-fade-in">
                <For each={buckets()}>
                  {(bucket) => (
                    <button
                      type="button"
                      onClick={() => handleBucketChange(bucket.id)}
                      class={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        currentBucketId() === bucket.id
                          ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                          : "hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {bucket.name}
                    </button>
                  )}
                </For>
              </div>
              <div
                class="fixed inset-0 z-40"
                onClick={() => setShowBucketMenu(false)}
              />
            </Show>
          </div>
        </Show>
      </div>

      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-[var(--bg-tertiary)]">
          <span
            class={`w-2 h-2 rounded-full ${statusClass()} ${connected() ? "animate-glow" : ""}`}
          />
          <span class="text-xs text-[var(--text-secondary)]">
            {connecting()
              ? "Connecting..."
              : connected()
                ? "Connected"
                : "Not connected"}
          </span>
        </div>

        <A href="/settings" class="btn-icon" title="Settings">
          <svg
            class="w-[18px] h-[18px]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </A>
      </div>
    </header>
  );
}
