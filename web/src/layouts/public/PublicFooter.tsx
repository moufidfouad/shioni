import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, MapPin } from "lucide-react";

const APPLICATION_LINKS = [
  { to: "/", label: "Accueil" },
  { to: "/ressources", label: "Ressources" },
  { to: "/about", label: "À propos" },
  { to: "/contact", label: "Contact" },
];

const ACCOUNT_LINKS = [
  { to: "/login", label: "Connexion" },
  { to: "/register", label: "Créer un compte" },
];

export default function PublicFooter() {
  return (
    <footer className="relative overflow-hidden border-t bg-linear-to-b from-card to-primary/5">
      <div aria-hidden="true" className="h-1 bg-linear-to-r from-success via-info to-primary" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto max-w-6xl px-6 py-12"
      >
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link to="/" className="text-lg font-semibold text-primary">
              🏫 SHIONI
            </Link>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              L'application de gestion écolière conçue aux Comores pour les écoles comoriennes : élèves, notes,
              présences, finances, emploi du temps, messagerie et bien plus, dans une seule plateforme.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="size-3.5 text-primary" />
              <span>Comores</span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Application</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {APPLICATION_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="transition-colors hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Compte</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {ACCOUNT_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="transition-colors hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/contact" className="inline-flex items-center gap-1.5 transition-colors hover:text-primary">
                  <Mail className="size-3.5" />
                  Nous écrire
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} SHIONI. Conçue aux Comores pour les écoles comoriennes.</span>
          <span className="text-xs">Fait avec soin pour les écoles comoriennes.</span>
        </div>
      </motion.div>
    </footer>
  );
}
