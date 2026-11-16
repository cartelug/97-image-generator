export function Logo({ height = 28, variant = "white", className = "" }: { height?: number; variant?: "white" | "black"; className?: string }) {
  // The real THE 97 artwork (never redrawn): 97-mark-*.png are the original 97.png with transparency.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/brand/97-mark-${variant}.png`} alt="THE 97" width={Math.round((height * 718) / 629)} height={height} className={className} draggable={false} />;
}

export function Lockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="lockup">
      <Logo height={compact ? 22 : 30} />
      {!compact && (
        <div className="lockup-text">
          <b>97 IMAGE GENERATOR</b>
          <span>THE 97 WORLD</span>
        </div>
      )}
    </div>
  );
}
