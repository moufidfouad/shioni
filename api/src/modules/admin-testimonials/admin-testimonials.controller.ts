import { Request, Response } from "express";
import { testimonialSchema } from "./admin-testimonials.schema";
import * as service from "./admin-testimonials.service";

export async function list(_req: Request, res: Response) {
  const testimonials = await service.listAllTestimonials();
  res.json(testimonials);
}

export async function upsert(req: Request, res: Response) {
  const input = testimonialSchema.parse(req.body);
  const testimonial = await service.upsertTestimonial(input);
  res.status(201).json(testimonial);
}

export async function remove(req: Request<{ id: string }>, res: Response) {
  await service.deleteTestimonial(req.params.id);
  res.status(204).send();
}
