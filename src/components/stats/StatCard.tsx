import { motion } from "framer-motion";
import { ReactNode } from "react";

interface StatCardProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export const StatCard = ({ children, delay = 0, className = "" }: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      className={`stat-card ${className}`}
    >
      {children}
    </motion.div>
  );
};
