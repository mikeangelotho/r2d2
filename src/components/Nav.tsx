import { createSignal, onMount } from "solid-js";
import { serverIsConfigured } from "~/lib/r2-server";

interface Props {
  onConnected: () => void;
}

export default function Nav(props: Props) {
  const [connected, setConnected] = createSignal(false);

  onMount(async () => {
    try {
      const configured = await serverIsConfigured();
      setConnected(configured);
    } catch (e) {
      console.error("Failed to check R2 status:", e);
    }
  });

  return (
    <nav class="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-[var(--text-primary)]">r2d2</span>
      </div>
      <div class="flex items-center gap-1.5 text-xs">
        <span class={`status-dot ${connected() ? "status-dot-success" : "status-dot-error"}`}></span>
        <span class="text-[var(--text-muted)]">
          {connected() ? "Connected" : "Not connected"}
        </span>
      </div>
    </nav>
  );
}
