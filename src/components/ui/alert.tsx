import React from "react";
import { cn } from "../../lib/utils";
import "./alert.css";

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive";
};

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  function Alert({ className, variant = "default", ...props }, ref) {
    return (
      <div
        ref={ref}
        role="alert"
        data-ui-alert=""
        data-variant={variant}
        className={cn(className)}
        {...props}
      />
    );
  }
);

export const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function AlertTitle({ className, ...props }, ref) {
  return (
    <h5 ref={ref} data-ui-alert-title="" className={cn(className)} {...props} />
  );
});

export const AlertDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function AlertDescription({ className, ...props }, ref) {
  return (
    <div ref={ref} data-ui-alert-desc="" className={cn(className)} {...props} />
  );
});
