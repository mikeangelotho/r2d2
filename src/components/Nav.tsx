import { useLocation, A } from "@solidjs/router";
import { createSignal, createEffect, onMount } from "solid-js";
import { serverIsConfigured } from "~/lib/r2-server";

export default function Nav() {
  const location = useLocation();
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
    <nav class="fixed top-0 left-0 right-0 z-50 glass border-b border-[var(--border-subtle)]">
      <div class="flex items-center justify-between px-4 h-14">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <div class="led led-amber"></div>
            <span class="font-mono text-sm tracking-wider text-[var(--text-primary)]">R2D2</span>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2 text-xs font-mono">
            <span class="text-[var(--text-muted)]">STATUS</span>
            <span class={`led ${connected() ? "led-green" : "led-red"} ${!connected() ? "led-pulse" : ""}`}></span>
            <span class={connected() ? "text-[var(--success)]" : "text-[var(--error)]"}>
              {connected() ? "CONNECTED" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
