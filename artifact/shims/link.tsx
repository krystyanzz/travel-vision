import type { AnchorHTMLAttributes } from "react";
import { navigate } from "../router";

export default function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const token = href.split("?")[0].replace(/^\//, "");
  return (
    <a
      {...rest}
      href={token ? `#${token}` : "#"}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault();
        navigate(href);
      }}
    />
  );
}
