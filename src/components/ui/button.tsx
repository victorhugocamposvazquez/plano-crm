import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "icon" | "round";
const variantClass: Record<Variant, string> = { primary: "btn btn-primary", secondary: "btn btn-secondary", ghost: "btn btn-ghost", icon: "btn btn-icon", round: "btn btn-round" };

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode };
export function Button({ variant = "secondary", className = "", type = "button", children, ...rest }: ButtonProps) {
  return <button type={type} className={`${variantClass[variant]} ${className}`.trim()} {...rest}>{children}</button>;
}

type LinkButtonProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; variant?: Variant; children: ReactNode };
export function LinkButton({ href, variant = "secondary", className = "", children, ...rest }: LinkButtonProps) {
  return <Link href={href} className={`${variantClass[variant]} ${className}`.trim()} {...rest}>{children}</Link>;
}
