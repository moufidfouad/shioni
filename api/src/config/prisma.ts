import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, $Enums } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

// Instance unique du client Prisma, réutilisée partout (évite d'épuiser le
// pool de connexions PostgreSQL en dev avec le rechargement à chaud).
export const prisma = new PrismaClient({ adapter });


export const SchoolRole = $Enums.SchoolRole;
export type SchoolRole = $Enums.SchoolRole;

export const Sex = $Enums.Sex;
export type Sex = $Enums.Sex;

export const FeeStatus = $Enums.FeeStatus;
export type FeeStatus = $Enums.FeeStatus;

export const AttendanceStatus = $Enums.AttendanceStatus;
export type AttendanceStatus = $Enums.AttendanceStatus;

export const FinanceEntryType = $Enums.FinanceEntryType;
export type FinanceEntryType = $Enums.FinanceEntryType;

export const EndOfYearDecisionType = $Enums.EndOfYearDecisionType;
export type EndOfYearDecisionType = $Enums.EndOfYearDecisionType;

export const ConversationType = $Enums.ConversationType;
export type ConversationType = $Enums.ConversationType;

export const ParticipantRole = $Enums.ParticipantRole;
export type ParticipantRole = $Enums.ParticipantRole;

export const ResourceType = $Enums.ResourceType;
export type ResourceType = $Enums.ResourceType;
