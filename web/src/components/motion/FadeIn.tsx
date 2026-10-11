import { ReactNode } from "react";
import { motion } from "framer-motion";

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}

// Petit fondu réutilisable pour une carte, une section ou un bloc isolé (pas
// une liste — voir Stagger.tsx pour les listes/grilles d'éléments répétés).
export default function FadeIn({ children, delay = 0, y = 8, className }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
