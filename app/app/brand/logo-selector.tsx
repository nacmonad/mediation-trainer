"use client";

import { Children, createContext, type ReactNode, useContext, useState } from "react";

type LogoSelection = {
  selectedId: string;
  select: (id: string) => void;
};

const LogoSelectionContext = createContext<LogoSelection | null>(null);

export function LogoSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedId, select] = useState("A");

  return (
    <LogoSelectionContext.Provider value={{ selectedId, select }}>
      {children}
    </LogoSelectionContext.Provider>
  );
}

function useLogoSelection() {
  const selection = useContext(LogoSelectionContext);

  if (!selection) {
    throw new Error("Logo controls must be rendered inside LogoSelectionProvider.");
  }

  return selection;
}

type LogoChoiceProps = {
  children: ReactNode;
  className: string;
  id: string;
  name: string;
};

export function LogoChoice({ children, className, id, name }: LogoChoiceProps) {
  const { selectedId, select } = useLogoSelection();
  const selected = selectedId === id;

  return (
    <button
      aria-label={`Show ${name} in the hero`}
      aria-pressed={selected}
      className={className}
      data-selected={selected || undefined}
      onClick={() => select(id)}
      type="button"
    >
      {children}
    </button>
  );
}

type HeroArtifactProps = {
  children: ReactNode;
  ids: string[];
  names: string[];
  className: string;
  markClassName: string;
  taglineClassName: string;
  wordmarkClassName: string;
};

export function HeroArtifact({
  children,
  ids,
  names,
  className,
  markClassName,
  taglineClassName,
  wordmarkClassName,
}: HeroArtifactProps) {
  const { selectedId } = useLogoSelection();
  const marks = Children.toArray(children);
  const selectedIndex = Math.max(0, ids.indexOf(selectedId));
  const selectedName = names[selectedIndex] ?? names[0];

  return (
    <div className={className} aria-label={`Leading symbol study: ${selectedName}`} aria-live="polite">
      <div className={markClassName}>{marks[selectedIndex] ?? marks[0]}</div>
      <div className={wordmarkClassName}>Obversa</div>
      <div className={taglineClassName}>Rehearse what cannot be scripted.</div>
    </div>
  );
}
