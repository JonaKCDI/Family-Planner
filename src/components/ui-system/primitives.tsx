import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type Tone = "brand" | "positive" | "negative" | "neutral" | "warning";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function PrimaryButton({ className, children, ...props }: ButtonProps) {
  return (
    <button className={clsx("button app-button app-button-primary", className)} {...props}>
      {children}
    </button>
  );
}

export function SecondaryButton({ className, children, ...props }: ButtonProps) {
  return (
    <button className={clsx("button secondary app-button app-button-secondary", className)} {...props}>
      {children}
    </button>
  );
}

type IconButtonProps = ButtonProps & {
  label: string;
};

export function IconButton({ className, children, label, title, ...props }: IconButtonProps) {
  return (
    <button className={clsx("icon-button app-icon-button", className)} aria-label={label} title={title ?? label} {...props}>
      {children}
    </button>
  );
}

export function FloatingActionButton({ className, children, ...props }: ButtonProps) {
  return (
    <button className={clsx("fab-button app-fab", className)} {...props}>
      {children}
    </button>
  );
}

export function Card({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <article className={clsx("card app-card", className)} {...props}>
      {children}
    </article>
  );
}

export function SectionCard({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={clsx("panel app-section-card", className)} {...props}>
      {children}
    </section>
  );
}

type MetricCardProps = HTMLAttributes<HTMLElement> & {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
};

export function MetricCard({ className, label, value, detail, tone = "neutral", ...props }: MetricCardProps) {
  return (
    <article className={clsx("stat app-metric-card", `app-metric-${tone}`, className)} {...props}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

export function Chip({ className, children, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span className={clsx("badge app-chip", `app-chip-${tone}`, className)} {...props}>
      {children}
    </span>
  );
}

export function StatusBadge({ className, children, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span className={clsx("badge status-chip app-status-badge", `app-status-${tone}`, className)} {...props}>
      {children}
    </span>
  );
}
