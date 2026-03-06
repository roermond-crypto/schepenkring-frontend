"use client";

import type { ComponentProps } from "react";
import {
  useParams,
  usePathname,
  useRouter as useNextRouter,
} from "next/navigation";
import React from "react";
import NextLink from "next/link";

type LinkProps = ComponentProps<typeof NextLink>;

function localizeHref(href: LinkProps["href"], locale?: string) {
  if (!locale || typeof href !== "string") {
    return href;
  }

  if (!href.startsWith("/")) {
    return href;
  }

  if (href === `/${locale}` || href.startsWith(`/${locale}/`)) {
    return href;
  }

  return `/${locale}${href}`;
}

export function Link({ href, ...props }: LinkProps) {
  const params = useParams();
  const locale = Array.isArray(params?.locale)
    ? params.locale[0]
    : params?.locale;

  return React.createElement(NextLink, {
    href: localizeHref(href, typeof locale === "string" ? locale : undefined),
    ...props,
  });
}

export function useRouter() {
  const router = useNextRouter();
  const params = useParams();
  const locale = Array.isArray(params?.locale)
    ? params.locale[0]
    : params?.locale;
  const localeValue = typeof locale === "string" ? locale : undefined;

  return {
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) =>
      router.push(localizeHref(href, localeValue) as string, options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
      router.replace(localizeHref(href, localeValue) as string, options),
    prefetch: (href: string) =>
      router.prefetch(localizeHref(href, localeValue) as string),
  };
}

export { usePathname };
