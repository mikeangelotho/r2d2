import { Router, Route } from "@solidjs/router";
import { Suspense, createSignal } from "solid-js";
import Nav from "~/components/Nav";
import Editor from "~/routes/editor";
import NotFound from "~/routes/[...404]";
import "./app.css";

export default function App() {
  const [refreshKey, setRefreshKey] = createSignal(0);

  return (
    <Router
      root={props => (
        <>
          <Nav onConnected={() => setRefreshKey(k => k + 1)} />
          <div class="pt-4">
            <Suspense fallback={<div class="p-4 text-sm text-[var(--text-muted)]">Loading...</div>}>
              {props.children}
            </Suspense>
          </div>
        </>
      )}
    >
      <Route path="/" component={Editor} />
      <Route path="*404" component={NotFound} />
    </Router>
  );
}
