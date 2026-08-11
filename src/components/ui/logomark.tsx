/**
 * The "F" doubles as a small waveform — three bars rising away from the
 * letter, standing in for a voice getting steadier with practice. Used
 * everywhere the plain letter mark used to be (sidebar, splash, login,
 * onboarding welcome).
 */
export function Logomark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 4v16" />
      <path d="M6 4h9" />
      <path d="M6 12h5" />
      <path d="M14.5 10v4" />
      <path d="M18 8.5v7" />
      <path d="M21.5 6.5v11" />
    </svg>
  );
}
