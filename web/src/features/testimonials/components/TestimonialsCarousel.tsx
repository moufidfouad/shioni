import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { usePublicTestimonialsQuery } from "../api";
import { Skeleton } from "@/components/Skeleton";
import { cn } from "@/lib/utils";
import FadeIn from "@/components/motion/FadeIn";

const AUTO_ADVANCE_MS = 6000;

export default function TestimonialsCarousel() {
  const query = usePublicTestimonialsQuery();
  const testimonials = query.data ?? [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || testimonials.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % testimonials.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [paused, testimonials.length]);

  // L'index peut dépasser la longueur si la liste change (rare, contenu
  // éditorial) — recalé plutôt que de risquer un accès hors bornes.
  const current =
    testimonials.length > 0 ? testimonials[index % testimonials.length] : null;

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  // Contenu non essentiel : une erreur réseau ou une liste vide ne doit pas
  // casser la landing page, la section disparaît simplement.
  if (query.isError || testimonials.length === 0 || !current) {
    return null;
  }

  function goTo(i: number) {
    setIndex(
      ((i % testimonials.length) + testimonials.length) % testimonials.length,
    );
  }

  return (
    <>
      {testimonials.length > 1 && (
        <section className="border-t py-20">
          <div className="mx-auto max-w-6xl px-6">
            <FadeIn className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold sm:text-3xl">
                Ils utilisent SHIONI
              </h2>
              <p className="mt-3 text-muted-foreground">
                Des directions et enseignants d'écoles comoriennes témoignent de
                leur usage au quotidien.
              </p>
            </FadeIn>
            <FadeIn delay={0.1} className="mt-12">
              <div
                className="relative mx-auto max-w-2xl"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
              >
                <div className="relative overflow-hidden rounded-2xl border bg-card px-8 py-10 shadow-sm sm:px-12">
                  <Quote
                    className="absolute left-6 top-6 size-10 text-primary/10"
                    aria-hidden="true"
                  />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={current.id}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="relative text-center"
                    >
                      <p className="text-balance text-lg italic text-foreground sm:text-xl">
                        « {current.content} »
                      </p>
                      <p className="mt-5 text-sm font-semibold">
                        {current.authorName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {current.authorRole}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <>
                  <button
                    type="button"
                    onClick={() => goTo(index - 1)}
                    aria-label="Témoignage précédent"
                    className="absolute left-0 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-full border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:text-primary sm:flex"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(index + 1)}
                    aria-label="Témoignage suivant"
                    className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 rounded-full border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:text-primary sm:flex"
                  >
                    <ChevronRight className="size-4" />
                  </button>

                  <div className="mt-6 flex items-center justify-center gap-2">
                    {testimonials.map((t, i) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => goTo(i)}
                        aria-label={`Aller au témoignage de ${t.authorName}`}
                        aria-current={i === index}
                        className={cn(
                          "h-2 rounded-full transition-all",
                          i === index
                            ? "w-6 bg-primary"
                            : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                        )}
                      />
                    ))}
                  </div>
                </>
              </div>
            </FadeIn>
          </div>
        </section>
      )}
    </>
  );
}
