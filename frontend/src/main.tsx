import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Top-level boundary so a render crash on a PUBLIC route (/, /parent/:token,
// /visa-pass, /mock-card, /pulse, …) shows the friendly retry card instead of
// white-screening the whole site. The /app subtree has its own route-keyed
// boundary inside Layout for per-page reset on navigation.
const tree = (
  <BrowserRouter>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {clientId ? <GoogleOAuthProvider clientId={clientId}>{tree}</GoogleOAuthProvider> : tree}
  </React.StrictMode>
);
