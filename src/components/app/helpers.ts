import type { Translation } from "@/lib/i18n";
import type { Role } from "@/lib/types";

export function roleLabelOf(role: Role, t: Translation): string {
  const map: Record<Role, string> = {
    Admin: t.roleAdmin,
    Manager: t.roleManager,
    AsstManager: t.roleAsstManager,
    Editor: t.roleEditor,
    Viewer: t.roleViewer,
  };
  return map[role] ?? role;
}

// Segmented-control styling (design's segStyle).
export function segStyle(active: boolean) {
  return {
    bd: active ? "#0f172a" : "#e3e8ef",
    bg: active ? "#0f172a" : "#fff",
    color: active ? "#fff" : "#5c6675",
  };
}
