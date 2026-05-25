import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { api } from "../api/client";
import { getUser, setAuth, clearAuth } from "../lib/progress";

// Renders nothing unless VITE_GOOGLE_CLIENT_ID is set (so the app still works in
// guest mode). When signed in, shows the name and a sign-out link.
export default function AuthButton() {
  const enabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [user, setUser] = useState(getUser());

  if (!enabled) return null;

  if (user) {
    return (
      <div className="text-xs text-slate-500">
        Signed in as <span className="font-medium text-slate-700">{user.name}</span>
        <button
          className="ml-2 underline hover:text-slate-700"
          onClick={() => {
            clearAuth();
            setUser(null);
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <GoogleLogin
      onSuccess={(cr) => {
        if (!cr.credential) return;
        api
          .authGoogle(cr.credential)
          .then((r) => {
            setAuth(r.token, r.user);
            setUser(r.user);
          })
          .catch(() => {});
      }}
      onError={() => {}}
    />
  );
}
