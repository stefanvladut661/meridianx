import type { Issue } from "@/lib/postari/limite";
import { cn } from "@/lib/utils";

/** Problemele unui clip sau ale unei postări: roșu = oprește aprobarea, chihlimbar = de știut. */
export function IssueList({ issues, prefix, className }: { issues: Issue[]; prefix?: string; className?: string }) {
  if (issues.length === 0) return null;
  return (
    <ul className={cn("grid gap-1", className)}>
      {issues.map((issue, index) => (
        <li key={`${issue.mesaj}-${index}`} className={cn("flex gap-2 text-[13px] leading-snug", issue.nivel === "eroare" ? "text-[var(--ap-error)]" : "text-[var(--ap-warn)]")}>
          <span aria-hidden className={cn("mt-[0.4em] h-1.5 w-1.5 shrink-0 rounded-full", issue.nivel === "eroare" ? "bg-[var(--ap-error)]" : "bg-[var(--ap-warn)]")} />
          <span>
            <span className="sr-only">{issue.nivel === "eroare" ? "Eroare: " : "Atenție: "}</span>
            {prefix ? <span className="font-semibold">{prefix} </span> : null}
            {issue.mesaj}
          </span>
        </li>
      ))}
    </ul>
  );
}
