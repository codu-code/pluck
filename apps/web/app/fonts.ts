import { Fredoka, Geist, Source_Serif_4 } from "next/font/google";

export const geist = Geist({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-geist" });
export const fredoka = Fredoka({ subsets: ["latin"], weight: ["700"], variable: "--font-fredoka" });
export const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif" });
