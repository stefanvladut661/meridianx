import { videoTestimonials } from "@/content/video/testimonials";
import { cn } from "@/lib/utils";

/**
 * Dovezi sociale — integral placeholder, marcat vizibil (FAZA 2).
 * Nu 3 carduri identice: primul citat ocupă un rând întreg, restul
 * împart al doilea. Se înlocuiesc cu testimoniale reale + acord scris.
 */
export function TestimonialStrip() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {videoTestimonials.map((testimonial, index) => (
        <figure
          key={testimonial.id}
          className={cn(
            "relative rounded-md border border-line bg-surface/60 p-6 sm:p-8",
            index === 0 && "md:col-span-2"
          )}
        >
          {testimonial.isPlaceholder ? (
            <span className="absolute right-4 top-4 rounded-xs border border-line px-2 py-1 font-mono text-[10px] tracking-[0.2em] text-fg/60">
              PLACEHOLDER
            </span>
          ) : null}
          <blockquote
            className={cn(
              "text-pretty pr-24 text-fg/85",
              index === 0 ? "text-xl sm:text-2xl" : "text-base"
            )}
          >
            „{testimonial.quote}”
          </blockquote>
          <figcaption className="mt-5 font-mono text-xs tracking-[0.15em] text-fg/60">
            {testimonial.author} · {testimonial.role} · {testimonial.company}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
