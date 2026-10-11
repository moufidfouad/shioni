import { Mail, MapPin, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import PageTransition from "@/components/motion/PageTransition";
import FadeIn from "@/components/motion/FadeIn";
import ContactForm from "@/features/contact/components/ContactForm";

export default function Contact() {
  return (
    <PageTransition>
      <section className="relative overflow-hidden bg-linear-to-b from-primary/5 via-background to-background">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-4xl px-6 py-16 sm:py-24">
          <FadeIn>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Contact
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Une question sur l'application ? Écrivez-nous et nous vous
              répondrons rapidement.
            </p>
          </FadeIn>

          <div className="mt-10 grid gap-8 lg:grid-cols-5">
            <FadeIn delay={0.1} className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Envoyer un message</CardTitle>
                  <CardDescription>
                    Tous les champs sont requis.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ContactForm />
                </CardContent>
              </Card>
            </FadeIn>

            <FadeIn delay={0.2} className="lg:col-span-2">
              <Card className="h-full border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-base">
                    Nous joindre autrement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      Ce formulaire reste le moyen le plus rapide de nous
                      joindre.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      Conçue aux Comores, pour les écoles comoriennes.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>Réponse sous quelques jours ouvrés.</span>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
