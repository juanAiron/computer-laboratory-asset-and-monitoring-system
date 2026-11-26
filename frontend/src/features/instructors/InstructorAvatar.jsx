import { useState } from "react";

export function InstructorAvatar({ name, photoUrl, className = "" }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials =
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <span
      role="img"
      aria-label={name ? `${name} profile photo` : "Instructor profile photo"}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-hunter-green font-bold text-cornsilk ${className}`}
    >
      {photoUrl && !imageFailed ? (
        <img
          src={photoUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
