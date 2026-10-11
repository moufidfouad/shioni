import { StaggerContainer, StaggerItem } from "@/components/motion/Stagger";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  Milestone,
  Share2,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

const ICON_STYLES = [
  "bg-primary/10 text-primary",
  "bg-info/10 text-info",
  "bg-success/10 text-success",
  "bg-warning/10 text-warning",
] as const;

const features = [
  {
    icon: Users,
    title: "Élèves & inscriptions",
    description:
      "Inscriptions, classes, niveaux de frais et suivi des dossiers, école par école.",
  },
  {
    icon: GraduationCap,
    title: "Notes & bulletins",
    description:
      "Matières, coefficients, saisie des notes et bulletins avec moyennes calculées automatiquement.",
  },
  {
    icon: ClipboardCheck,
    title: "Présences",
    description: "Suivi des présences, absences et retards, classe par classe.",
  },
  {
    icon: Wallet,
    title: "Finances & écolage",
    description:
      "Recettes, charges et suivi précis des paiements d'écolage, jusqu'à l'élève.",
  },
  {
    icon: Milestone,
    title: "Décisions de fin d'année",
    description:
      "Passage, redoublement, réorientation : les décisions de fin d'année, avec confirmation pour les cas sensibles.",
  },
  {
    icon: CalendarClock,
    title: "Emploi du temps",
    description:
      "Une grille horaire par classe et par enseignant pour organiser la semaine.",
  },
  {
    icon: UserCog,
    title: "Personnel",
    description:
      "Gestion du personnel enseignant et administratif de chaque établissement.",
  },
  {
    icon: BarChart3,
    title: "Analyse pédagogique",
    description:
      "Effectifs, présence et moyennes analysés par cycle, classe, série, groupe ou salle.",
  },
  {
    icon: MessageCircle,
    title: "Messagerie",
    description:
      "Conversations privées ou de groupe en temps réel, entre équipes, enseignants, parents et élèves.",
  },
  {
    icon: LayoutDashboard,
    title: "Portails Parent & Élève",
    description:
      "Un espace dédié pour suivre bulletins, présences et paiements de son enfant, ou les siens.",
  },
  {
    icon: Share2,
    title: "Ressources partagées",
    description:
      "Documents et vidéos partagés publiquement, par matière et par classe.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-écoles, rôles & recherche",
    description:
      "Plusieurs établissements, des rôles précis pour chaque membre, et une recherche d'élève entre écoles d'une même organisation.",
  },
];

export default function FeaturesList() {
  return (
    <section className="border-t bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Tout ce qu'il faut pour gérer un établissement
          </h2>
          <p className="mt-3 text-muted-foreground">
            Conçu pour les directions, enseignants et équipes administratives —
            et ouvert aux parents et aux élèves.
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
                      ICON_STYLES[i % ICON_STYLES.length],
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
  );
}
