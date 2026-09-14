import { useEffect, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';

// Colors, gradients, and states come from the .btn classes in index.css.
const buttonBase =
  'btn inline-flex items-center justify-center gap-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50';

const buttonVariants = {
  primary: 'btn-primary',
  secondary: '',
  ghost: 'btn-ghost',
  /** Destructive confirmations only. */
  danger: 'btn-danger',
  /** For title bars and the app header. */
  bar: 'btn-bar',
} as const;

const buttonSizes = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-2 text-sm',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
}

export function Button({ variant = 'secondary', size = 'md', type = 'button', className = '', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    />
  );
}

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Renders a glossy title bar with this heading. */
  title?: ReactNode;
  /** Controls on the right side of the title bar (use Button variant="bar"). */
  actions?: ReactNode;
  bodyClassName?: string;
}

export function Card({ title, actions, className = '', bodyClassName = '', children, ...props }: CardProps) {
  return (
    <section className={`panel ${className}`} {...props}>
      {title !== undefined && (
        <header className="panel-titlebar">
          <h2 className="panel-title">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}

/** Modal window built on the native <dialog> (Esc and backdrop clicks close it). */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="panel dialog"
    >
      <div className="panel-titlebar">
        <h2 className="panel-title">{title}</h2>
        <Button variant="bar" size="sm" onClick={onClose} aria-label="Close">
          ✕
        </Button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}

/** Recessed text input styling (see .field in index.css). */
export const inputClass = 'field w-full px-3 py-2';

export function FieldErrors({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul className="mt-1 text-sm text-danger">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

export function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={`text-xs tabular-nums ${value > max ? 'text-danger' : 'text-ink-muted'}`}>
      {value}/{max}
    </span>
  );
}
