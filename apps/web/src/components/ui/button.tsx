import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "bg-primary text-white hover:bg-primary/90",
      outline: "border border-border bg-white hover:bg-muted",
      ghost: "hover:bg-muted",
      destructive: "bg-destructive text-white hover:opacity-90"
    },
    size: { default: "h-11 px-4", sm: "h-9 px-3 text-sm", icon: "h-11 w-11" }
  },
  defaultVariants: { variant: "default", size: "default" }
});

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;
export function Button({ className, variant, size, ...props }: Props) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
