import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-pink-400 focus-visible:ring-pink-300/50 focus-visible:ring-[3px] aria-invalid:ring-red-300/20 dark:aria-invalid:ring-red-400/40 aria-invalid:border-red-400",
  {
    variants: {
      variant: {
        default:
          "bg-pink-100 text-pink-900 shadow-sm hover:bg-pink-200",
        destructive:
          "bg-red-300 text-white shadow-sm hover:bg-red-400 focus-visible:ring-red-400/40 dark:bg-red-500",
        outline:
          "border border-pink-300 bg-pink-50 text-pink-900 shadow-sm hover:bg-pink-100 dark:bg-pink-900 dark:border-pink-600 dark:hover:bg-pink-700 dark:text-pink-200",
        secondary:
          "bg-pink-200 text-pink-800 shadow-sm hover:bg-pink-300",
        ghost:
          "hover:bg-pink-100 hover:text-pink-900 dark:hover:bg-pink-800",
        link: "text-pink-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
