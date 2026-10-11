import { GraduationCap, Layers, ShieldCheck, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageTransition from "@/components/motion/PageTransition";
import FadeIn from "@/components/motion/FadeIn";
import { StaggerContainer, StaggerItem } from "@/components/motion/Stagger";

const values = [
  {
    icon: Layers,
    title: "Multi-établissements",
    description:
      "Chaque organisation peut gérer plusieurs écoles indépendantes, chacune avec ses propres classes, niveaux de frais et membres.",
  },
  {
    icon: ShieldCheck,
    title: "Rôles précis",
    description:
      "Administration, gestion des élèves, gestion des notes, gestion des finances, enseignants : chaque membre n'accède qu'à ce dont il a besoin.",
  },
  {
    icon: GraduationCap,
    title: "Pensé pour le quotidien",
    description:
      "Des listes paginées, des formulaires validés et une interface simple pour les tâches répétées de la vie scolaire.",
  },
  {
    // Itération 60 — demande utilisateur : la page ne mentionnait que la
    // gestion écolière « classique », alors que l'application couvre aussi
    // la communication (messagerie, portails Parent/Élève, ressources
    // partagées) — voir LandingPage.tsx pour la liste complète des modules.
    icon: MessageCircle,
    title: "Au-delà de la gestion",
    description:
      "Messagerie interne en temps réel, portails dédiés pour les parents et les élèves, et des ressources pédagogiques partagées publiquement.",
  },
];

export default function About() {
  return (
    <PageTransition>
      <section className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
        <FadeIn>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">À propos</h1>
        </FadeIn>
        <FadeIn delay={0.1}>
          <p className="mt-4 text-muted-foreground sm:text-lg">
            SHIONI est une application conçue aux Comores pour les écoles comoriennes, afin de les aider à
            centraliser la gestion de leurs élèves, de leurs matières, de leurs notes, de leurs présences, de leur
            personnel, de leur emploi du temps et de leurs finances — jusqu'à la messagerie interne et des
            portails dédiés pour les parents et les élèves — au sein d'une seule plateforme, organisée école par
            école.
          </p>
        </FadeIn>

        <StaggerContainer className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v) => (
            <StaggerItem key={v.title}>
              <Card className="h-full">
                <CardHeader>
                  <v.icon className="size-8 text-primary" />
                  <CardTitle className="mt-2 text-base">{v.title}</CardTitle>
                  <CardDescription>{v.description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <FadeIn delay={0.2} className="mt-12">
          <p className="text-sm text-muted-foreground">
            Une question, une suggestion ? N'hésitez pas à nous écrire depuis la page{" "}
            {/* Itération 108 — constat Lighthouse "Accessibilité" (itération 60) :
                lien distingué de son texte environnant par la seule couleur
                (`text-primary`, soulignement seulement au survol). `underline`
                en permanence ajoute un indice non-couleur, conforme WCAG 1.4.1. */}
            <Link to="/contact" className="text-primary underline hover:underline">
              Contact
            </Link>
            .
          </p>
        </FadeIn>
      </section>
    </PageTransition>
  );
}
