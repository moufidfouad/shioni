import FadeIn from "@/components/motion/FadeIn";
import { Button } from "@/components/ui/button";
import { Layers, LayoutDashboard, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const STATS = [
  { icon: Layers, label: "12 modules" },
  { icon: ShieldCheck, label: "Multi-écoles & rôles" },
  { icon: LayoutDashboard, label: "Portails Parent & Élève" },
];

export default function HeroLanding() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-primary/10 via-background to-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-32 size-80 rounded-full bg-info/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 size-72 -translate-x-1/2 rounded-full bg-success/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <FadeIn>
          <span className="inline-flex items-center rounded-full border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            Conçue aux Comores, pour les écoles comoriennes
          </span>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            SHIONI — pilotez vos écoles depuis une seule plateforme
          </h1>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground sm:text-lg">
            Élèves, notes, présences, finances, emploi du temps et messagerie :
            une application unique pour piloter plusieurs établissements, avec
            des rôles adaptés à chaque membre de votre équipe — et des portails
            dédiés pour les parents et les élèves.
          </p>
        </FadeIn>
        <FadeIn delay={0.3}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
{/*             <Button asChild size="lg">
              <Link to="/register">Créer un compte gratuitement</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/about">En savoir plus</Link>
            </Button> */}
          </div>
        </FadeIn>

        <FadeIn delay={0.4}>
          <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-3">
            {STATS.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-2 rounded-full border bg-card/80 px-4 py-2 text-sm font-medium text-foreground backdrop-blur"
              >
                <s.icon className="size-4 text-primary" />
                {s.label}
              </span>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
