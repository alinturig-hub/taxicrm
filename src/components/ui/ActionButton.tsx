import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

type ActionButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost";

type ActionButtonSize = "sm" | "md" | "lg";

type SharedProps = {
  children: ReactNode;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  icon?: ReactNode;
  className?: string;
  fullWidth?: boolean;
};

type ButtonProps = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type LinkProps = SharedProps & {
  href: string;
  type?: never;
  disabled?: boolean;
};

type ActionButtonProps = ButtonProps | LinkProps;

const variantClasses: Record<ActionButtonVariant, string> = {
  primary:
    "border-brand bg-brand text-white shadow-sm hover:border-brand-hover hover:bg-brand-hover focus:ring-brand/20",
  secondary:
    "border-app-border bg-white text-app-primary shadow-sm hover:border-app-border-strong hover:bg-surface-subtle focus:ring-brand/15",
  danger:
    "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 focus:ring-red-500/15",
  ghost:
    "border-transparent bg-transparent text-app-secondary hover:bg-surface-muted hover:text-app-primary focus:ring-brand/15",
};

const sizeClasses: Record<ActionButtonSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export default function ActionButton(props: ActionButtonProps) {
  const {
    children,
    variant = "primary",
    size = "md",
    icon,
    className = "",
    fullWidth = false,
  } = props;

  const classes = [
    "inline-flex items-center justify-center gap-2 rounded-appMd border font-semibold outline-none transition-all duration-150",
    "focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if ("href" in props && props.href) {
    const { href, disabled } = props;

    if (disabled) {
      return (
        <span
          className={`${classes} cursor-not-allowed opacity-50`}
          aria-disabled="true"
        >
          {icon ? <span aria-hidden="true">{icon}</span> : null}
          <span>{children}</span>
        </span>
      );
    }

    return (
      <Link href={href} className={classes}>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        <span>{children}</span>
      </Link>
    );
  }

  const {
    type = "button",
    ...buttonProps
  } = props as ButtonProps;

  return (
    <button
      type={type}
      {...buttonProps}
      className={classes}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
