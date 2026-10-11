import { AlertTriangle, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface ErrorPageProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}


export default function ErrorPage({
  title = "Une erreur est survenue",
  message = "Quelque chose s'est mal passé de notre côté. Vous pouvez réessayer ou revenir à l'accueil.",
  onRetry,
}: ErrorPageProps) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <CardHeader className="items-center">
          <AlertTriangle className="mb-2 h-10 w-10 text-destructive" />
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex justify-center gap-3">
            {onRetry && (
              <Button variant="outline" onClick={onRetry}>
                <RotateCcw className="h-4 w-4" />
                Réessayer
              </Button>
            )}
            <Button asChild>
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
