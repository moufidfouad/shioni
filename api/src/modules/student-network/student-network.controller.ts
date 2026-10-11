import { Request, Response } from "express";
import { studentNetworkSearchSchema } from "./student-network.schema";
import { searchStudentNetwork } from "./student-network.service";

// `req.params.schoolId` n'intervient JAMAIS dans la recherche elle-même
// (voir student-network.service.ts) — il n'a servi qu'à l'autorisation
// (route montée sous /schools/:schoolId/student-network, restreinte à
// ADMIN/GESTION_ELEVES, voir student-network.routes.ts). Le personnel de
// N'IMPORTE QUELLE école peut ainsi rechercher, mais seulement s'il détient
// déjà l'un de ces deux rôles dans SA PROPRE école.
export async function search(req: Request<{ schoolId: string }>, res: Response) {
  const input = studentNetworkSearchSchema.parse(req.query);
  const field = input.nationalIdNumber ? "nationalIdNumber" : "ministryStudentNumber";
  const value = (input.nationalIdNumber ?? input.ministryStudentNumber)!;
  const result = await searchStudentNetwork(field, value);
  res.json(result);
}
