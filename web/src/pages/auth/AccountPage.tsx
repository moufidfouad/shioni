import Navbar from "../../components/Navbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import PageTransition from "@/components/motion/PageTransition";
import ChangePasswordForm from "@/features/auth/components/ChangePasswordForm";

export default function AccountPage() {
  return (
    <div>
      <Navbar />
      <PageTransition>
        <div className="mx-auto max-w-md px-6 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Mon compte</CardTitle>
              <CardDescription>Changez votre mot de passe.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </div>
  );
}
