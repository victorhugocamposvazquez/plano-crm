import { applyCommand as apply, type Actor, type Role } from "@/lib/domain";
export const applyCommand = apply;
export const demoActorFor = (name: string, role: Role): Actor => ({ id: "00000000-0000-4000-8000-00000000009" + (role === "office" ? "1" : "2"), name, role });
