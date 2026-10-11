import { Request, Response } from "express";
import * as membersService from "./members.service";
import {
  addMemberSchema,
  createParentAccountSchema,
  createStudentAccountSchema,
  createTeacherAccountSchema,
  updateRolesSchema,
} from "./members.schema";

export async function list(req: Request<{ schoolId: string }>, res: Response) {
  const members = await membersService.listMembers(req.params.schoolId);
  res.json(members);
}

export async function add(req: Request<{ schoolId: string }>, res: Response) {
  const body = addMemberSchema.parse(req.body);
  const member = await membersService.addMember(req.params.schoolId, body.email, body.roles);
  res.status(201).json(member);
}

export async function updateRoles(req: Request<{ schoolId: string; userId: string }>, res: Response) {
  const roles = updateRolesSchema.parse(req.body.roles);
  const result = await membersService.setMemberRoles(req.params.schoolId, req.params.userId, roles);
  res.json(result);
}

export async function remove(req: Request<{ schoolId: string; userId: string }>, res: Response) {
  await membersService.removeMember(req.params.schoolId, req.params.userId);
  res.status(204).send();
}

export async function resetPassword(req: Request<{ schoolId: string; userId: string }>, res: Response) {
  const result = await membersService.resetMemberPassword(req.params.schoolId, req.params.userId);
  res.json(result);
}

export async function createTeacherAccount(req: Request<{ schoolId: string }>, res: Response) {
  const body = createTeacherAccountSchema.parse(req.body);
  const result = await membersService.createTeacherAccount(req.params.schoolId, body);
  res.status(201).json(result);
}

export async function createParentAccount(req: Request<{ schoolId: string }>, res: Response) {
  const body = createParentAccountSchema.parse(req.body);
  const result = await membersService.createParentAccount(req.params.schoolId, body);
  res.status(201).json(result);
}

export async function createStudentAccount(req: Request<{ schoolId: string }>, res: Response) {
  const body = createStudentAccountSchema.parse(req.body);
  const result = await membersService.createStudentAccount(req.params.schoolId, body);
  res.status(201).json(result);
}
