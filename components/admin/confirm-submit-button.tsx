"use client";

type ConfirmSubmitButtonProps = {
  children: React.ReactNode;
  confirmMessage: string;
  className?: string;
};

export function ConfirmSubmitButton({ children, confirmMessage, className }: ConfirmSubmitButtonProps) {
  return (
    <button
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      {children}
    </button>
  );
}
