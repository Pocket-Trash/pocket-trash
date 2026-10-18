import { faUserLock } from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Requests square Clerk image dimensions at twice the avatar's CSS dimensions.
 *
 * @param imageUrl - Selected Clerk picture, or null when absent.
 * @param size - Primitive size: 22.5 or 37.5 CSS pixels at the 15px root font.
 * @returns Clerk proxy URL, or undefined for an absent or malformed URL.
 */
export function publicProfileImageUrl(
  imageUrl: string | null,
  size: "sm" | "lg",
) {
  if (!imageUrl) return undefined;
  try {
    const url = new URL(imageUrl);
    // ponytail: update these requests when the root font or avatar size tokens change.
    const pixels = size === "sm" ? "45" : "75";
    url.searchParams.set("width", pixels);
    url.searchParams.set("height", pixels);
    url.searchParams.delete("fit");
    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * Renders a decorative public picture beside a visible owner name.
 *
 * @param props - Selected Clerk picture, username fallback, and display size.
 * @returns Public avatar with an initials fallback on absence or load failure.
 */
export function PublicProfileAvatar({
  imageUrl,
  isPrivate = false,
  username,
  size = "sm",
}: {
  /** Selected Clerk picture URL, or null when absent. */
  imageUrl: string | null;
  /** Whether the public attribution must suppress identity. @default false */
  isPrivate?: boolean;
  /** Visible username used for the initials fallback. */
  username: string | null;
  /** Avatar primitive size. @default "sm" */
  size?: "sm" | "lg";
}) {
  const src = isPrivate ? undefined : publicProfileImageUrl(imageUrl, size);
  return (
    <Avatar aria-hidden="true" size={size}>
      {src ? <AvatarImage alt="" src={src} /> : null}
      <AvatarFallback>
        {isPrivate ? (
          <FontAwesomeIcon aria-hidden="true" icon={faUserLock} />
        ) : (
          username?.slice(0, 1).toUpperCase()
        )}
      </AvatarFallback>
    </Avatar>
  );
}
