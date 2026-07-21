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
    "border-blue-500 bg-blue-600 text-white hover:bg-blue-500 focus:ring-blue-500/30",
  secondary:
    "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 focus:ring-slate-500/30",
  danger:
    "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 focus:ring-red-500/30",
  ghost:
    "border-transparent bg-transparent text-slate-400 hover:bg-slate-800 hover:text-white focus:ring-slate-500/30",
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
    "inline-flex items-center justify-center gap-2 rounded-xl border font-semibold outline-none transition",
    "focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
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
