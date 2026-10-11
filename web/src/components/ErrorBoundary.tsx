import { Component, ErrorInfo, ReactNode } from "react";
import ErrorPage from "./ErrorPage";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Filet de sécurité pour toute l'application (monté autour de <Suspense> +
// <Routes> dans App.tsx) : une erreur de rendu React n'est interceptable que
// par un composant CLASSE implémentant `getDerivedStateFromError`/
// `componentDidCatch` — il n'existe pas d'équivalent hook. Attrape aussi
// l'échec de chargement d'un chunk `React.lazy` (page ouverte alors qu'un
// nouveau déploiement a changé les noms de fichiers hashés, typiquement) et
// affiche ErrorPage avec un bouton "Réessayer" qui recharge la page, plutôt
// que de laisser un écran blanc.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erreur non interceptée :", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage onRetry={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
