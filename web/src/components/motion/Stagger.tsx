import { ReactNode } from "react";
import { motion } from "framer-motion";

// Conteneur + élément pour animer une liste/grille (cartes d'écoles, lignes,
// etc.) avec un léger effet de cascade ("stagger") à l'apparition. Utiliser
// `StaggerContainer` autour de la liste et `StaggerItem` autour de chaque
// élément répété.

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export function StaggerContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={itemVariants} transition={{ duration: 0.25, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}
