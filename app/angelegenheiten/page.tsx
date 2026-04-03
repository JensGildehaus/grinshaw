import Link from "next/link";

export default function Angelegenheiten() {
  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <header
        style={{
          width: "100%",
          borderBottom: "1px solid var(--g-border)",
          padding: "1rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxSizing: "border-box",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "1.2rem",
            letterSpacing: "0.12em",
            color: "var(--g-gold)",
            fontWeight: 700,
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Grinshaw
        </Link>
        <span
          style={{
            fontSize: "0.65rem",
            color: "var(--g-muted)",
            letterSpacing: "0.08em",
            fontFamily: "var(--font-playfair), Georgia, serif",
            textTransform: "uppercase",
            textAlign: "right",
          }}
        >
          Die laufenden<br />Angelegenheiten
        </span>
      </header>

      <div
        style={{
          width: "100%",
          maxWidth: "640px",
          padding: "4rem 1.5rem",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--g-muted)",
            lineHeight: "1.7",
            fontStyle: "italic",
          }}
        >
          „Sie haben mir bislang nichts aufgetragen. Das ist entweder sehr
          entspannt oder sehr beunruhigend."
        </p>
      </div>
    </div>
  );
}
