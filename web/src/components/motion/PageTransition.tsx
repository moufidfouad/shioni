import { ReactNode } from "react";
import { motion } from "framer-motion";

// Enveloppe une page entière avec une animation d'entrée légère (fondu +
// léger glissement vers le haut). Utilisé en tête de chaque composant de
// page ; l'API `motion.div` + prop `variants` est l'API stable et
// documentée de framer-motion depuis ses toutes premières versions (vérifié
// sur le paquet installé : `motion` et `AnimatePresence` sont bien exportés
// tels quels par framer-motion@13).
const variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export default function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
