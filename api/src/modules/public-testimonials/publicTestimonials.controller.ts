import { Request, Response } from "express";
import * as publicTestimonialsService from "./publicTestimonials.service";

export async function list(_req: Request, res: Response) {
  const testimonials = await publicTestimonialsService.listPublishedTestimonials();
  res.json(testimonials);
}
