import { Link } from "react-router-dom";
import {
  GraduationCap,
  Users,
  Wallet,
  ClipboardCheck,
  BarChart3,
  ShieldCheck,
  Milestone,
  CalendarClock,
  UserCog,
  MessageCircle,
  LayoutDashboard,
  Share2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/motion/PageTransition";
import FadeIn from "@/components/motion/FadeIn";
import { StaggerContainer, StaggerItem } from "@/components/motion/Stagger";
import TestimonialsCarousel from "@/features/testimonials/components/TestimonialsCarousel";

// Itération 62 — rotation de 4 couleurs (tokens existants uniquement, voir
// DESIGN-TOKENS.md) pour les puces d'icône des cartes de fonctionnalités,
// plutôt qu'un unique `text-primary` répété 12 fois — écrites en toutes
// lettres (pas de concaténation de classes à l'exécution) pour que Tailwind
// les détecte à la compilation.
const ICON_STYLES = [
  "bg-primary/10 text-primary",
  "bg-info/10 text-info",
  "bg-success/10 text-success",
  "bg-warning/10 text-warning",
] as const;

const STATS = [
  { icon: Layers, label: "12 modules" },
  { icon: ShieldCheck, label: "Multi-écoles & rôles" },
  { icon: LayoutDashboard, label: "Portails Parent & Élève" },
];

// Itération 60 — demande utilisateur : la page publique ne mentionnait que
// élèves/notes/présences/finances, alors que l'application couvre bien plus
// (voir SchoolLayout.tsx pour la liste réelle des modules). Liste étoffée
// pour refléter fidèlement l'étendue fonctionnelle, mêmes libellés/icônes
// que la navigation authentifiée pour rester cohérent.
const features = [
  {
    icon: Users,
    title: "Élèves & inscriptions",
    description: "Inscriptions, classes, niveaux de frais et suivi des dossiers, école par école.",
  },
  {
    icon: GraduationCap,
    title: "Notes & bulletins",
    description: "Matières, coefficients, saisie des notes et bulletins avec moyennes calculées automatiquement.",
  },
  {
    icon: ClipboardCheck,
    title: "Présences",
    description: "Suivi des présences, absences et retards, classe par classe.",
  },
  {
    icon: Wallet,
    title: "Finances & écolage",
    description: "Recettes, charges et suivi précis des paiements d'écolage, jusqu'à l'élève.",
  },
  {
    icon: Milestone,
    title: "Décisions de fin d'année",
    description: "Passage, redoublement, réorientation : les décisions de fin d'année, avec confirmation pour les cas sensibles.",
  },
  {
    icon: CalendarClock,
    title: "Emploi du temps",
    description: "Une grille horaire par classe et par enseignant pour organiser la semaine.",
  },
  {
    icon: UserCog,
    title: "Personnel",
    description: "Gestion du personnel enseignant et administratif de chaque établissement.",
  },
  {
    icon: BarChart3,
    title: "Analyse pédagogique",
    description: "Effectifs, présence et moyennes analysés par cycle, classe, série, groupe ou salle.",
  },
  {
    icon: MessageCircle,
    title: "Messagerie",
    description: "Conversations privées ou de groupe en temps réel, entre équipes, enseignants, parents et élèves.",
  },
  {
    icon: LayoutDashboard,
    title: "Portails Parent & Élève",
    description: "Un espace dédié pour suivre bulletins, présences et paiements de son enfant, ou les siens.",
  },
  {
    icon: Share2,
    title: "Ressources partagées",
    description: "Documents et vidéos partagés publiquement, par matière et par classe.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-écoles, rôles & recherche",
    description:
      "Plusieurs établissements, des rôles précis pour chaque membre, et une recherche d'élève entre écoles d'une même organisation.",
  },
];

export default function LandingPage() {
  return (
    <PageTransition>
      {/* Bannière — itération 62 : demande utilisateur "une section
          banner" avec plus de couleur/animation. Dégradé + formes
          décoratives floutées (tokens existants uniquement), même
          technique que Contact.tsx. */}
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
            {/* Itération 108 — constat Lighthouse "Accessibilité" (itération 60) :
                contraste insuffisant sur l'accueil. Ce badge flotte sur un fond
                dégradé + formes floutées colorées (voir plus haut) ; `bg-card/80`
                laisse transparaître cette teinte, et `text-muted-foreground`
                n'atteint plus que ~4,45:1 dans le pire cas (< 4,5:1). `text-foreground/70`
                reste visuellement discret tout en donnant ~7,4:1 même sur le fond
                le plus clair possible ici. */}
            <span className="inline-flex items-center rounded-full border bg-card/80 px-3 py-1 text-xs font-medium text-foreground/70 backdrop-blur">
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
              Élèves, notes, présences, finances, emploi du temps et messagerie : une application unique pour
              piloter plusieurs établissements, avec des rôles adaptés à chaque membre de votre équipe — et des
              portails dédiés pour les parents et les élèves.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/register">Créer un compte gratuitement</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/about">En savoir plus</Link>
              </Button>
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

      {/* Features */}
      <section className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">Tout ce qu'il faut pour gérer un établissement</h2>
            <p className="mt-3 text-muted-foreground">
              Conçu pour les directions, enseignants et équipes administratives — et ouvert aux parents et aux
              élèves.
            </p>
          </div>

          <StaggerContainer className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <StaggerItem key={f.title}>
                <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
                  <CardHeader>
                    <span
                      className={cn(
                        "inline-flex size-12 items-center justify-center rounded-xl",
                        ICON_STYLES[i % ICON_STYLES.length]
                      )}
                    >
                      <f.icon className="size-6" />
                    </span>
                    <CardTitle className="mt-2 text-base">{f.title}</CardTitle>
                    <CardDescription>{f.description}</CardDescription>
                  </CardHeader>
                  <CardContent />
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Témoignages — itération 62 : demande utilisateur "une section
          testimonials (dynamiques)". Alimentée par une vraie table backend
          (voir features/testimonials/api.ts), carrousel animé dans
          TestimonialsCarousel.tsx. Section entière masquée par le composant
          lui-même si la liste est vide ou en erreur (contenu non essentiel
          sur une page marketing). */}
      <section className="border-t py-20">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">Ils utilisent SHIONI</h2>
            <p className="mt-3 text-muted-foreground">
              Des directions et enseignants d'écoles comoriennes témoignent de leur usage au quotidien.
            </p>
          </FadeIn>
          <FadeIn delay={0.1} className="mt-12">
            <TestimonialsCarousel />
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <FadeIn className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">Prêt à démarrer ?</h2>
          <p className="mt-3 text-muted-foreground">
            Créez votre compte, ajoutez votre première école et invitez votre équipe en quelques minutes.
          </p>
          <div className="mt-6">
            <Button asChild size="lg">
              <Link to="/register">Créer mon compte</Link>
            </Button>
          </div>
        </FadeIn>
      </section>
    </PageTransition>
  );
}
