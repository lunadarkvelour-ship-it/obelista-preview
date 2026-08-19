import {
  Clapperboard, Crosshair, FileText, GitBranch, LayoutGrid, Layers, MessageSquareText,
  Rocket, Target, Type, UserRound, Wallet, type LucideIcon,
} from "lucide-react";

export interface RailSection {
  id: string;
  idx: string;
  label: string;
  phase: string;
  /** Значок для свёрнутого сайдбара — там подписи не помещаются. */
  icon: LucideIcon;
}

export const SECTIONS: RailSection[] = [
  { id: "profile", idx: "01", label: "Profile", phase: "Setup", icon: UserRound },
  { id: "structure", idx: "02", label: "Structure", phase: "Setup", icon: Layers },
  { id: "goal", idx: "03", label: "Objective", phase: "Setup", icon: Target },
  { id: "budget", idx: "04", label: "Budget", phase: "Setup", icon: Wallet },
  { id: "targeting", idx: "05", label: "Targeting", phase: "Target & Creative", icon: Crosshair },
  { id: "placements", idx: "06", label: "Placements", phase: "Target & Creative", icon: LayoutGrid },
  { id: "page", idx: "07", label: "Page and offer", phase: "Target & Creative", icon: FileText },
  { id: "creatives", idx: "08", label: "Creatives", phase: "Target & Creative", icon: Clapperboard },
  { id: "groups", idx: "08b", label: "URL param groups", phase: "Target & Creative", icon: GitBranch },
  { id: "naming", idx: "09", label: "Naming", phase: "Launch", icon: Type },
  { id: "launch", idx: "10", label: "Launch", phase: "Launch", icon: Rocket },
  { id: "notes", idx: "11", label: "Notes", phase: "Launch", icon: MessageSquareText },
];
