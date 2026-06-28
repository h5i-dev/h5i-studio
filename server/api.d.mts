import type { Router } from "express";

/** Build the read-only h5i REST router (shared by dev middleware + server). */
export function createApiRouter(): Router;
