import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...values: ClassValue[]) {
    return twMerge(clsx(values));
}
