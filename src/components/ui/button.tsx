import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-lg shadow-primary/40 hover:bg-primary/85 hover:shadow-xl hover:shadow-primary/50",
        destructive:
          "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/40 hover:bg-destructive/85 hover:shadow-xl hover:shadow-destructive/50",
        outline:
          "border-2 border-primary bg-transparent text-primary shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-lg hover:shadow-primary/40",
        secondary:
          "bg-secondary text-secondary-foreground shadow-md hover:bg-primary hover:text-primary-foreground hover:shadow-lg hover:shadow-primary/40",
        ghost:
          "text-foreground hover:bg-primary hover:text-primary-foreground",
        link:
          "text-primary underline-offset-4 hover:underline hover:text-primary/80 font-semibold",
        premium:
          "bg-primary text-primary-foreground shadow-xl shadow-primary/50 hover:bg-primary/85 hover:shadow-2xl hover:shadow-primary/60",
        success:
          "bg-[#ff4000] text-white shadow-lg shadow-[#ff4000]/40 hover:bg-[#ff4000] hover:shadow-xl hover:shadow-[#ff4000]/50",
        warning:
          "bg-[#ff4000] text-white shadow-lg shadow-[#ff4000]/40 hover:bg-[#ff4000] hover:shadow-xl hover:shadow-[#ff4000]/50",
        dark:
          "bg-slate-900 text-white shadow-lg shadow-slate-900/50 hover:bg-primary hover:shadow-xl hover:shadow-primary/50",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-7 text-base",
        xl: "h-14 rounded-xl px-8 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
