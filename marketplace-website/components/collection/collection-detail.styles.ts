import styles from "./collection-detail.module.css";

/**
 * Join one or more CSS-module class names. Falsy entries are dropped, so
 * conditional classes read cleanly: c("card", active && "on").
 */
export function c(
  ...names: Array<string | false | null | undefined>
): string {
  return names
    .filter((name): name is string => Boolean(name))
    .map((name) => styles[name])
    .filter(Boolean)
    .join(" ");
}

export default styles;
