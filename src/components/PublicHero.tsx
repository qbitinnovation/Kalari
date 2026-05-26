"use client";

import React from "react";
import { cn } from "@/lib/cn";

export function HeroBadge({
  icon,
  children,
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hero-badge-primary inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-black/10 backdrop-blur-sm",
        className,
      )}
    >
      {icon ? <span>{icon}</span> : null}
      {children}
    </div>
  );
}

export function PublicHero({
  badge,
  badgeIcon,
  title,
  description,
  image,
  align = "center",
  className,
}: {
  badge: string;
  badgeIcon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  image: string;
  align?: "center" | "left";
  className?: string;
}) {
  const centered = align === "center";

  return (
    <section
      className={cn(
        "relative overflow-hidden bg-stone-950 px-4 pb-24 pt-32 text-white sm:px-6 lg:px-8",
        className,
      )}
    >
      <img
        src={image}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-stone-950/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/75 via-stone-950/20 to-stone-950/35" />
      <div
        className={cn(
          "relative z-10 mx-auto max-w-7xl",
          centered && "text-center",
        )}
      >
        <HeroBadge icon={badgeIcon}>{badge}</HeroBadge>
        <h1
          className={cn(
            "mt-6 max-w-5xl text-5xl font-black leading-[0.98] tracking-tight md:text-7xl",
            centered && "mx-auto",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "mt-6 max-w-2xl text-lg font-semibold leading-8 text-white/82",
              centered && "mx-auto",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}
