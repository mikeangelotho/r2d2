import { Router, Route } from "@solidjs/router";
import { Suspense } from "solid-js";
import Nav from "~/components/Nav";
import Editor from "~/routes/editor";
import NotFound from "~/routes/[...404]";
import "./app.css";

export default function App() {
  return (
    <Router
      root={props => (
        <>
          <Nav />
          <Suspense>{props.children}</Suspense>
        </>
      )}
    >
      <Route path="/" component={Editor} />
      <Route path="*404" component={NotFound} />
    </Router>
  );
}
