import type { ReactNode } from "react";
import FadeIn from "@/components/motion/FadeIn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


export default function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  /** Lien de bas de carte (ex. "Déjà un compte ? Se connecter"). */
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-12">
      <FadeIn className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {children}
            {footer && <p className="text-center text-sm text-muted-foreground">{footer}</p>}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
