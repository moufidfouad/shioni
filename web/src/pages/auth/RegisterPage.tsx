import { Link } from "react-router-dom";
import AuthCard from "@/features/auth/components/AuthCard";
import RegisterForm from "@/features/auth/components/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthCard
      title="Créer un compte"
      description="Vous pourrez ensuite créer autant d'écoles que vous le souhaitez."
      footer={
        <>
          Déjà inscrit(e) ?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
