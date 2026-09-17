export type RacerId = "chili" | "pip" | "bolt" | "moss" | "nova" | "coco";

export type Racer = {
  id: RacerId;
  name: string;
  tagline: string;
  color: string;
  accent: string;
  helmet: string;
};

export const RACERS: Racer[] = [
  {
    id: "chili",
    name: "Chili",
    tagline: "Runs hot",
    color: "#e23d4a",
    accent: "#ffd2c4",
    helmet: "#7a1420",
  },
  {
    id: "pip",
    name: "Pip",
    tagline: "Cuts inside",
    color: "#d97832",
    accent: "#ffd7b0",
    helmet: "#6b3a12",
  },
  {
    id: "bolt",
    name: "Bolt",
    tagline: "Late apex",
    color: "#2aa7c0",
    accent: "#d4f4fb",
    helmet: "#0f4c5c",
  },
  {
    id: "moss",
    name: "Moss",
    tagline: "Holds the line",
    color: "#3aa35a",
    accent: "#d6f3c8",
    helmet: "#1c4a28",
  },
  {
    id: "nova",
    name: "Nova",
    tagline: "Night shift",
    color: "#4c6adf",
    accent: "#dce3ff",
    helmet: "#1b2458",
  },
  {
    id: "coco",
    name: "Coco",
    tagline: "All heart",
    color: "#c49a72",
    accent: "#fff0de",
    helmet: "#5c3d28",
  },
];

export function racerById(id: string): Racer {
  return RACERS.find((r) => r.id === id) ?? RACERS[0]!;
}
