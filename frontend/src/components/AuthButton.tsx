import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { api } from "../api/client";
import { getUser, setAuth, clearAuth, getProfileId } from "../lib/progress";

// Renders nothing unless VITE_GOOGLE_CLIENT_ID is set (so the app still works in
// guest mode). When signed in, shows the name and a sign-out link.
export default function AuthButton() {
  const enabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [user, setUser] = useState(getUser());

  if (!enabled) return null;

  if (user) {
    return (
      <div className="rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs text-muted">
        Signed in as <span className="font-medium text-ink">{user.name}</span>
        <button
          className="ml-2 underline hover:text-ink"
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
          .then(async (r) => {
            setAuth(r.token, r.user);
            setUser(r.user);
            // Claim the profile built as a guest on this device so memory + progress
            // carry over to the account (the token is now in storage for auth headers).
            const pid = getProfileId();
            if (pid) await api.getProfile(pid).catch(() => {});
          })
          .catch(() => {});
      }}
      onError={() => {}}
    />
  );
}
