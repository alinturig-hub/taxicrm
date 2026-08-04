import type { HTMLAttributes, ReactNode } from "react";

type AppCardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  interactive?: boolean;
};

export function AppCard({
  children,
  interactive = false,
  className = "",
  ...props
}: AppCardProps) {
  return (
    <section
      {...props}
      className={[
        "app-card",
        interactive ? "app-card-interactive" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}

type AppCardHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function AppCardHeader({
  title,
  description,
  action,
  className = "",
}: AppCardHeaderProps) {
  return (
    <header className={["app-card-header", className].join(" ")}>
      <div className="min-w-0">
        <h3 className="app-section-title">{title}</h3>

        {description ? (
          <p className="app-section-description">
            {description}
          </p>
        ) : null}
      </div>

      {action ? (
        <div className="shrink-0">
          {action}
        </div>
      ) : null}
    </header>
  );
}

type AppCardContentProps = {
  children: ReactNode;
  className?: string;
};

export function AppCardContent({
  children,
  className = "",
}: AppCardContentProps) {
  return (
    <div className={["app-card-content", className].join(" ")}>
      {children}
    </div>
  );
}

type AppCardFooterProps = {
  children: ReactNode;
  className?: string;
};

export function AppCardFooter({
  children,
  className = "",
}: AppCardFooterProps) {
  return (
    <footer className={["app-card-footer", className].join(" ")}>
      {children}
    </footer>
  );
}
