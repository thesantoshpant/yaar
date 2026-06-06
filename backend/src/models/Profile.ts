import mongoose, { Schema } from "mongoose";
import type { StudentProfile } from "../lib/types";

const profileSchema = new Schema<StudentProfile>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    name: { type: String, required: true },
    country: { type: String, required: true },
    gpa: String,
    intendedLevel: { type: String, enum: ["undergraduate", "graduate"], default: "undergraduate" },
    intendedMajor: String,
    budgetUsdPerYear: Number,
    testStatus: String,
    careerGoal: String,
    targetIntake: String,
    gradeLevel: String,
    isRural: Boolean,
    firstGen: Boolean,
    schoolHasCounselor: Boolean,
    schoolHasClubs: Boolean,
    familiarWithProcess: Boolean,
    wontGoWithoutAid: Boolean,
    emailOptIn: Boolean,
    createdAt: { type: String, required: true },
  },
  { collection: "profiles" }
);

export const ProfileModel =
  (mongoose.models.Profile as mongoose.Model<StudentProfile>) ||
  mongoose.model<StudentProfile>("Profile", profileSchema);
