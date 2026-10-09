import NextLink from "next/link";
import type { ComponentProps } from "react";

export default function FinanceLink(props: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} prefetch={false} />;
}
