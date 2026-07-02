"use client";

import {
  createElement,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { s } from "@/lib/style";

type HovProps = {
  tag?: keyof JSX.IntrinsicElements;
  css?: string;
  hover?: string;
  style?: CSSProperties;
  children?: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

// A generic element that applies a base CSS string plus an optional
// hover CSS string — lets ported markup keep its `style` + `style-hover`.
export function Hov({ tag = "div", css = "", hover = "", style, children, ...rest }: HovProps) {
  const [h, setH] = useState(false);
  return createElement(
    tag,
    {
      ...rest,
      style: { ...s(css), ...(h && hover ? s(hover) : {}), ...(style || {}) },
      onMouseEnter: (e: unknown) => {
        setH(true);
        rest.onMouseEnter?.(e);
      },
      onMouseLeave: (e: unknown) => {
        setH(false);
        rest.onMouseLeave?.(e);
      },
    },
    children,
  );
}

// Non-interactive styled box (no hover) — shorthand for <div style={s(css)}>.
export function Box({
  css = "",
  style,
  children,
  tag = "div",
  ...rest
}: HovProps) {
  return createElement(tag, { ...rest, style: { ...s(css), ...(style || {}) } }, children);
}
