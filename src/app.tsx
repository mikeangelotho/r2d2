import { Router, Route } from "@solidjs/router";
import { Suspense } from "solid-js";
import Editor from "~/routes/editor";
import Settings from "~/routes/settings";
import NotFound from "~/routes/[...404]";
import "./app.css";

export default function App() {
  return (
    <Router
      root={props => (
        <Suspense fallback={<div class="p-4 text-sm text-[var(--text-muted)]">Loading...</div>}>
          {props.children}
        </Suspense>
      )}
    >
      <Route path="/" component={Editor} />
      <Route path="/settings" component={Settings} />
      <Route path="*404" component={NotFound} />
    </Router>
  );
}
