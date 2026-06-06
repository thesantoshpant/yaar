import { Router } from "express";
import { z } from "zod";
import { store } from "../lib/store";
import { classify } from "../lib/classify";
import { recomputeJourney } from "../services/journey";
import { seedProfileFacts } from "../services/memoryUpdate";
import { listPersonas, seedPersona } from "../services/personaSeeds";
import { assertOwnership } from "../lib/userAuth";
import { createTier } from "../lib/rateLimit";

export const profileRouter = Router();

// Creating a profile (or seeding a sample student) creates durable state and adds
// to the nightly cron fan-out, so scripted creation is rate limited per IP.
const createLimit = createTier();

// Sample students for instant demos and to show Yaar adapts to different journeys.
// Registered before "/:id" so "personas" isn't mistaken for a profile id.
profileRouter.get("/personas", (_req, res) => {
  res.json({ personas: listPersonas() });
});

profileRouter.post("/seed-persona", ...createLimit, async (req, res) => {
  const key = typeof req.body?.persona === "string" ? req.body.persona : "";
  const profile = await seedPersona(key);
  if (!profile) return res.status(404).json({ error: "Unknown persona" });
  res.json({ profile });
});

const profileSchema = z.object({
  name: z.string().min(1),
  country: z.string().min(1),
  gpa: z.string().optional(),
  intendedLevel: z.enum(["undergraduate", "graduate"]).default("undergraduate"),
  intendedMajor: z.string().optional(),
  budgetUsdPerYear: z.number().optional(),
  testStatus: z.string().optional(),
  careerGoal: z.string().optional(),
  targetIntake: z.string().optional(),
  // persona signals
  gradeLevel: z.enum(["9", "10", "11", "12", "gap", "bachelors"]).optional(),
  isRural: z.boolean().optional(),
  firstGen: z.boolean().optional(),
  schoolHasCounselor: z.boolean().optional(),
  schoolHasClubs: z.boolean().optional(),
  familiarWithProcess: z.boolean().optional(),
  wontGoWithoutAid: z.boolean().optional(),
});

const updateSchema = profileSchema.partial();

// Guests can create a profile too (we want top-of-funnel to be frictionless). If the
// request carries a token, the profile is owned by that user; otherwise it stays
// unowned until the student signs in, at which point assertOwnership claims it.
profileRouter.post("/", ...createLimit, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const profile = await store.createProfile({ ...parsed.data, userId: req.userId });
  // Seed the personalized journey + memory immediately so the student gets value at once.
  await store.upsertJourney(classify(profile));
  await store.addEvent({ profileId: profile.id, kind: "signup", summary: `Joined Yaar from ${profile.country}` });
  // Seed the student's mind from everything the form told us.
  await seedProfileFacts(profile);
  res.json({ profile });
});

profileRouter.get("/:id", async (req, res) => {
  await assertOwnership(req, req.params.id);
  const profile = await store.getProfile(req.params.id);
  if (!profile) return res.status(404).json({ error: "Not found" });
  res.json({ profile });
});

profileRouter.patch("/:id", async (req, res) => {
  await assertOwnership(req, req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const profile = await store.updateProfile(req.params.id, parsed.data);
  if (!profile) return res.status(404).json({ error: "Not found" });
  await recomputeJourney(profile.id); // re-personalize, preserving completed-module progress
  await seedProfileFacts(profile); // keep memory in sync with the latest profile
  res.json({ profile });
});

// Delete my data: permanently erase everything Yaar knows about this student.
// This is the promise on the privacy page, so it covers every collection.
profileRouter.delete("/:id", async (req, res) => {
  await assertOwnership(req, req.params.id);
  const profile = await store.getProfile(req.params.id);
  if (!profile) return res.status(404).json({ error: "Not found" });
  await store.deleteProfileData(req.params.id);
  res.json({ ok: true, deleted: req.params.id });
});
