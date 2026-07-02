import { AppProvider } from "@/components/app/AppProvider";
import AppShell from "@/components/app/AppShell";

export default function Page() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
