/* Geometric tile for the brand panel — a repeating pattern, never imagery.
   Lifted in spirit from mockup A's <pattern>, redrawn as an eight-point girih star. */
export function Lattice({ className = '', opacity = 0.06 }: { className?: string; opacity?: number }) {
  return (
    <svg className={className} aria-hidden="true" style={{ opacity }}>
      <defs>
        <pattern id="girih" width="72" height="72" patternUnits="userSpaceOnUse">
          <path d="M36 2 L48 14 L70 14 L70 36 L58 48 L58 70 L36 70 L24 58 L2 58 L2 36 L14 24 L14 2 Z"
                fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M36 14 L58 36 L36 58 L14 36 Z" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="36" cy="36" r="4.5" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#girih)" />
    </svg>
  );
}
