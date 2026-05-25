import { Router } from "express";
import { z } from "zod";
import { store } from "../lib/store";
import { classify } from "../lib/classify";

export const profileRouter = Router();

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

profileRouter.post("/", async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const profile = await store.createProfile(parsed.data);
  // Seed the personalized journey + memory immediately so the student gets value at once.
  await store.upsertJourney(classify(profile));
  await store.addEvent({ profileId: profile.id, kind: "signup", summary: `Joined Yaar from ${profile.country}` });
  if (profile.intendedMajor) {
    await store.addFacts([
      { profileId: profile.id, key: "goal.major", type: "goal", value: `Intended major: ${profile.intendedMajor}`, confidence: 0.9, source: "student_stated" },
    ]);
  }
  res.json({ profile });
});

profileRouter.get("/:id", async (req, res) => {
  const profile = await store.getProfile(req.params.id);
  if (!profile) return res.status(404).json({ error: "Not found" });
  res.json({ profile });
});

profileRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const profile = await store.updateProfile(req.params.id, parsed.data);
  if (!profile) return res.status(404).json({ error: "Not found" });
  await store.upsertJourney(classify(profile)); // re-personalize after changes
  res.json({ profile });
});
