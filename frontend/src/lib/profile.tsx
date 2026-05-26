// One shared student profile for the whole app. Every form reads from and writes
// to this, so a fact entered once (or changed anywhere) is remembered everywhere.
// It persists to localStorage instantly and syncs to the backend in the background.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { getProfileId, setProfileId, setProfileSummary } from "./progress";

export interface ProfileForm {
  name: string;
  country: string;
  intendedLevel: "undergraduate" | "graduate";
  intendedMajor: string;
  budget: string; // numeric string or ""
  targetIntake: string;
  testStatus: string;
  gradeLevel: string; // "9".."12" | "gap" | "bachelors"
  careerGoal: string;
  isRural: string; // "yes" | "no" | ""
  firstGen: string;
  schoolHasCounselor: string;
  schoolHasClubs: string;
  familiarWithProcess: string;
}

export const DEFAULT_PROFILE: ProfileForm = {
  name: "",
  country: "Nepal",
  intendedLevel: "undergraduate",
  intendedMajor: "",
  budget: "",
  targetIntake: "Fall 2027",
  testStatus: "",
  gradeLevel: "11",
  careerGoal: "",
  isRural: "",
  firstGen: "",
  schoolHasCounselor: "",
  schoolHasClubs: "",
  familiarWithProcess: "",
};

const FORM_KEY = "yaar.profile.form";
const yn = (v: string): boolean | undefined => (v === "yes" ? true : v === "no" ? false : undefined);
const ynStr = (v: boolean | undefined): string => (v === true ? "yes" : v === false ? "no" : "");

function loadLocal(): ProfileForm {
  try {
    const raw = localStorage.getItem(FORM_KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<ProfileForm>) };
  } catch {
    // ignore
  }
  return DEFAULT_PROFILE;
}

// Backend profile record -> our form shape.
function fromServer(p: Record<string, unknown>): Partial<ProfileForm> {
  const out: Partial<ProfileForm> = {};
  if (typeof p.name === "string" && p.name !== "Student") out.name = p.name;
  if (typeof p.country === "string") out.country = p.country;
  if (p.intendedLevel === "undergraduate" || p.intendedLevel === "graduate") out.intendedLevel = p.intendedLevel;
  if (typeof p.intendedMajor === "string") out.intendedMajor = p.intendedMajor;
  if (typeof p.budgetUsdPerYear === "number") out.budget = String(p.budgetUsdPerYear);
  if (typeof p.targetIntake === "string") out.targetIntake = p.targetIntake;
  if (typeof p.testStatus === "string") out.testStatus = p.testStatus;
  if (typeof p.gradeLevel === "string") out.gradeLevel = p.gradeLevel;
  if (typeof p.careerGoal === "string") out.careerGoal = p.careerGoal;
  out.isRural = ynStr(p.isRural as boolean | undefined);
  out.firstGen = ynStr(p.firstGen as boolean | undefined);
  out.schoolHasCounselor = ynStr(p.schoolHasCounselor as boolean | undefined);
  out.schoolHasClubs = ynStr(p.schoolHasClubs as boolean | undefined);
  out.familiarWithProcess = ynStr(p.familiarWithProcess as boolean | undefined);
  return out;
}

export function toPayload(f: ProfileForm): Record<string, unknown> {
  return {
    name: f.name || "Student",
    country: f.country,
    intendedLevel: f.intendedLevel,
    intendedMajor: f.intendedMajor || undefined,
    budgetUsdPerYear: f.budget ? Number(f.budget) : undefined,
    targetIntake: f.targetIntake || undefined,
    testStatus: f.testStatus || undefined,
    gradeLevel: f.gradeLevel || undefined,
    careerGoal: f.careerGoal || undefined,
    isRural: yn(f.isRural),
    firstGen: yn(f.firstGen),
    schoolHasCounselor: yn(f.schoolHasCounselor),
    schoolHasClubs: yn(f.schoolHasClubs),
    familiarWithProcess: yn(f.familiarWithProcess),
  };
}

export function profileSummary(f: ProfileForm): string {
  return `name=${f.name || "student"}, country=${f.country}, level=${f.intendedLevel}, major=${
    f.intendedMajor || "undecided"
  }, budget/yr=${f.budget || "unknown"}, intake=${f.targetIntake}, tests=${f.testStatus || "not started"}, grade=${
    f.gradeLevel
  }, career=${f.careerGoal || "?"}, rural=${f.isRural || "?"}, firstGen=${f.firstGen || "?"}, counselor=${
    f.schoolHasCounselor || "?"
  }, clubs=${f.schoolHasClubs || "?"}`;
}

interface ProfileCtx {
  profile: ProfileForm;
  profileId: string | null;
  hasProfile: boolean; // a backend profile exists
  setField: (patch: Partial<ProfileForm>) => void;
  saveNow: () => Promise<string | undefined>;
  reset: () => void;
  summary: () => string;
}

const Ctx = createContext<ProfileCtx | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ProfileForm>(loadLocal);
  const [profileId, setPid] = useState<string | null>(getProfileId());
  const latest = useRef(profile);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  latest.current = profile;

  // Keep profileSummary fresh for AI calls, and mirror the form to localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
    setProfileSummary(profileSummary(profile));
  }, [profile]);

  // On first load, if a profile exists on the server, treat it as the source of truth.
  useEffect(() => {
    const pid = getProfileId();
    if (!pid) return;
    api
      .getProfile(pid)
      .then((res) => {
        if (res.profile) setProfile((prev) => ({ ...prev, ...fromServer(res.profile as Record<string, unknown>) }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create on the server if there's no id yet, otherwise patch. Returns the id.
  const saveNow = useCallback(async (): Promise<string | undefined> => {
    const payload = toPayload(latest.current);
    const existing = getProfileId();
    if (existing) {
      await api.updateProfile(existing, payload).catch(() => {});
      return existing;
    }
    try {
      const res = await api.createProfile(payload);
      setProfileId(res.profile.id);
      setPid(res.profile.id);
      void api.runDrop(res.profile.id); // kick off the first weekly drop
      return res.profile.id;
    } catch {
      return undefined;
    }
  }, []);

  const setField = useCallback((patch: Partial<ProfileForm>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
    // Debounced background sync so edits on any page are remembered server-side.
    if (getProfileId()) {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => void saveNow(), 1200);
    }
  }, [saveNow]);

  const reset = useCallback(() => {
    setProfile(DEFAULT_PROFILE);
    setPid(null);
    try {
      localStorage.removeItem(FORM_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value: ProfileCtx = {
    profile,
    profileId,
    hasProfile: !!profileId,
    setField,
    saveNow,
    reset,
    summary: () => profileSummary(latest.current),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile(): ProfileCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}
