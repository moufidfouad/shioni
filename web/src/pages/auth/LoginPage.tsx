import { Link } from "react-router-dom";
import AuthCard from "@/features/auth/components/AuthCard";
import LoginForm from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <AuthCard
      title="Connexion"
      description="Accédez à vos écoles."
      footer={
        <>
          Pas encore inscrit(e) ?{" "}
          <Link to="/register" className="text-primary hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
