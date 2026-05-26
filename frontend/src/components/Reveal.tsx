import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Shared easing curve (typed as a bezier tuple so Framer Motion's types accept it).
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Scroll-triggered fade-up reveal for landing sections. Honors the user's
// reduced-motion preference by rendering statically.
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

// Stagger container + item for grids of cards.
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
export const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};
