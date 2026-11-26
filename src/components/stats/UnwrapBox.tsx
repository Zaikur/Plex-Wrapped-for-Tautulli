import { useTheme } from "@/hooks/use-theme";
import { GiftBox, type GiftBoxProps } from "./GiftBox";
import { VhsCase } from "./VhsCase";

/** What the top movie and show come in: a gift, or a VHS case in the retro themes */
export const UnwrapBox = (props: GiftBoxProps) => {
  const { reveal } = useTheme();
  if (reveal === "gift") return <GiftBox {...props} />;
  return <VhsCase design={reveal === "rentalCase" ? "rental" : "blank"} {...props} />;
};
