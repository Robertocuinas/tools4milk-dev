import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SyntheticMarker({ className = "" }: { className?: string }) {
  return (
    <Badge tone="warning" className={className}>
      <FlaskConical className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
      Datos de demo sintética
    </Badge>
  );
}
