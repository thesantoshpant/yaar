import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { api } from "../api/client";
import { getUser, setAuth, clearAuth, clearStudent, getProfileId, setProfileId } from "../lib/progress";

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
            // Sign-out must leave NOTHING of this student on the device: many of
            // our users share computers. Their data stays safe on the server under
            // their account and comes back the moment they sign in again.
            clearAuth();
            clearStudent();
            window.location.assign("/");
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
            const pid = getProfileId();
            if (pid) {
              // Active guest work on this device: claim it so it carries over.
              try {
                await api.getProfile(pid);
              } catch {
                // Stale (deleted) or someone else's profile: drop it and fall
                // back to the profile this account actually owns.
                clearStudent();
                if (r.profileId) setProfileId(r.profileId);
              }
            } else if (r.profileId) {
              // Clean device (fresh, or post sign-out): restore the profile this
              // account owns so their memory + progress come back.
              setProfileId(r.profileId);
            }
            // Reload so every provider re-reads the (possibly restored) profile.
            window.location.reload();
          })
          .catch(() => {});
      }}
      onError={() => {}}
    />
  );
}
