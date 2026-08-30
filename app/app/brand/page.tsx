import type { Metadata } from "next";
import Link from "next/link";
import { Source_Serif_4 } from "next/font/google";

import styles from "./brand.module.css";
import { HeroArtifact, LogoChoice, LogoSelectionProvider } from "./logo-selector";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Obversa brand study",
  description: "A preliminary visual identity study for Obversa.",
};

type MarkProps = {
  className?: string;
  label?: string;
};

function MarkThreshold({ className, label = "Threshold symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="M72 22C43 26 22 50 22 80s21 54 50 58V22Z" fill="currentColor" />
      <path d="M88 22c29 4 50 28 50 58s-21 54-50 58V22Z" fill="currentColor" />
    </svg>
  );
}

function MarkChambers({ className, label = "Chambers symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="M18 32h56v96H18V32Zm20 20v56h18V52H38Z" fill="currentColor" fillRule="evenodd" />
      <path d="M86 32h56v96H86V32Zm18 20v56h18V52h-18Z" fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

function MarkPerspectives({ className, label = "Perspectives symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="M20 80c0-31 23-56 52-60v120c-29-4-52-29-52-60Z" fill="currentColor" />
      <path d="M140 80c0 25-17 47-40 54V26c23 7 40 29 40 54Z" fill="currentColor" />
      <circle cx="92" cy="80" r="8" fill="currentColor" />
    </svg>
  );
}

function MarkFold({ className, label = "Fold symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="m20 31 54 23v75L20 106V31Z" fill="currentColor" />
      <path d="m140 31-54 23v75l54-23V31Z" fill="currentColor" />
    </svg>
  );
}

function MarkCommonTable({ className, label = "Common Table symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="M18 42c0-11 9-20 20-20h34v48H18V42Z" fill="currentColor" />
      <path d="M88 22h34c11 0 20 9 20 20v28H88V22Z" fill="currentColor" />
      <path d="M56 90h48v48H76c-11 0-20-9-20-20V90Z" fill="currentColor" />
    </svg>
  );
}

function MarkHeldSpace({ className, label = "Held Space symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="M20 28h54v22H42v60h32v22H20V28Z" fill="currentColor" />
      <path d="M86 28h54v104H86v-22h32V50H86V28Z" fill="currentColor" />
      <rect x="70" y="70" width="20" height="20" rx="3" fill="currentColor" />
    </svg>
  );
}

function MarkPassage({ className, label = "Passage symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="M18 24h64v48H62c-13 0-24 11-24 24v40H18V24Z" fill="currentColor" />
      <path d="M142 136H78V88h20c13 0 24-11 24-24V24h20v112Z" fill="currentColor" />
    </svg>
  );
}

function MarkRoundTable({ className, label = "Round Table symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <circle cx="80" cy="80" r="28" fill="currentColor" />
      <rect x="58" y="14" width="44" height="20" rx="10" fill="currentColor" />
      <rect x="58" y="14" width="44" height="20" rx="10" fill="currentColor" transform="rotate(120 80 80)" />
      <rect x="58" y="14" width="44" height="20" rx="10" fill="currentColor" transform="rotate(240 80 80)" />
    </svg>
  );
}

function MarkThreeSeats({ className, label = "Three Seats symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="M60 16h40v42H60V16Z" fill="currentColor" />
      <path d="M60 16h40v42H60V16Z" fill="currentColor" transform="rotate(120 80 80)" />
      <path d="M60 16h40v42H60V16Z" fill="currentColor" transform="rotate(240 80 80)" />
    </svg>
  );
}

function MarkSharedField({ className, label = "Shared Field symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <circle
        cx="80"
        cy="80"
        r="52"
        fill="none"
        stroke="currentColor"
        strokeWidth="32"
        strokeDasharray="91 18"
        transform="rotate(-90 80 80)"
      />
    </svg>
  );
}

function MarkFacilitatedRing({ className, label = "Facilitated Ring symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="M35 52A58 58 0 0 1 125 52" fill="none" stroke="currentColor" strokeWidth="30" />
      <path d="M27 70A58 58 0 0 0 70 137" fill="none" stroke="currentColor" strokeWidth="30" />
      <path d="M90 137A58 58 0 0 0 133 70" fill="none" stroke="currentColor" strokeWidth="30" />
    </svg>
  );
}

function MarkQuietGuide({ className, label = "Quiet Guide symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="M39 49A56 56 0 0 1 121 49" fill="none" stroke="currentColor" strokeWidth="16" />
      <path d="M27 69A56 56 0 0 0 70 136" fill="none" stroke="currentColor" strokeWidth="32" />
      <path d="M90 136A56 56 0 0 0 133 69" fill="none" stroke="currentColor" strokeWidth="32" />
    </svg>
  );
}

function MarkOpenSeat({ className, label = "Open Seat symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <circle cx="80" cy="82" r="31" fill="none" stroke="currentColor" strokeWidth="10" />
      <rect x="25" y="91" width="40" height="24" rx="12" fill="currentColor" transform="rotate(31 45 103)" />
      <rect x="95" y="91" width="40" height="24" rx="12" fill="currentColor" transform="rotate(-31 115 103)" />
      <path d="M60 31h40v22H60z" fill="none" stroke="currentColor" strokeWidth="9" />
    </svg>
  );
}

function MarkMediationNotch({ className, label = "Mediation Notch symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path
        d="M80 13a67 67 0 1 1-47 19l24 24a33 33 0 1 0 46 0l24-24A67 67 0 0 1 80 13Z"
        fill="currentColor"
        fillRule="evenodd"
      />
      <rect x="72" y="13" width="16" height="42" fill="currentColor" />
    </svg>
  );
}

function MarkOpenChannel({ className, label = "Open Channel symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="M18 80c0-31 22-57 54-63v38c-11 5-18 14-18 25s7 20 18 25v38c-32-6-54-32-54-63Z" fill="currentColor" />
      <path d="M142 80c0-31-22-57-54-63v38c11 5 18 14 18 25s-7 20-18 25v38c32-6 54-32 54-63Z" fill="currentColor" />
    </svg>
  );
}

function MarkThirdLens({ className, label = "Third Lens symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="M18 80c0-31 22-57 54-63v31c0 12-4 23-12 32 8 9 12 20 12 32v31c-32-6-54-32-54-63Z" fill="currentColor" />
      <path d="M142 80c0-31-22-57-54-63v31c0 12 4 23 12 32-8 9-12 20-12 32v31c32-6 54-32 54-63Z" fill="currentColor" />
    </svg>
  );
}

function MarkQuietSeat({ className, label = "Quiet Seat symbol study" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="M18 80c0-31 22-57 54-63v45H61c-8 0-14 8-14 18s6 18 14 18h11v45c-32-6-54-32-54-63Z" fill="currentColor" />
      <path d="M142 80c0-31-22-57-54-63v45h11c8 0 14 8 14 18s-6 18-14 18H88v45c32-6 54-32 54-63Z" fill="currentColor" />
    </svg>
  );
}

const studies = [
  {
    id: "A",
    name: "Threshold",
    note: "The clearest O. Two equal fields define a narrow room between them.",
    Mark: MarkThreshold,
  },
  {
    id: "B",
    name: "Chambers",
    note: "More architectural. Private interiors stay visible without becoming a floor plan.",
    Mark: MarkChambers,
  },
  {
    id: "C",
    name: "Perspectives",
    note: "Intentionally unequal. The center point gives the Mediator a distinct position.",
    Mark: MarkPerspectives,
  },
  {
    id: "D",
    name: "Fold",
    note: "Two faces of one object. Strong at larger sizes, less resolved as a favicon.",
    Mark: MarkFold,
  },
];

const secondRound = [
  {
    id: "E",
    name: "Common Table",
    note: "Three distinct seats around an open center. The mediation reading is strongest, though the geometry needs optical refinement.",
    Mark: MarkCommonTable,
  },
  {
    id: "F",
    name: "Held Space",
    note: "Opposing structures hold a defined middle. The small center gives the Mediator presence without turning the mark into a face.",
    Mark: MarkHeldSpace,
  },
  {
    id: "G",
    name: "Passage",
    note: "Two fixed positions create an indirect path between them. More procedural and ownable, less literal about mediation.",
    Mark: MarkPassage,
  },
];

const commonTableRound = [
  {
    id: "H",
    name: "Round Table",
    note: "A literal shared table with three equal seats. It communicates mediation quickly and keeps every role oriented toward the same work.",
    Mark: MarkRoundTable,
  },
  {
    id: "I",
    name: "Three Seats",
    note: "The table becomes negative space. Three equal forms imply Party, Party, and Mediator without assigning hierarchy or outcome.",
    Mark: MarkThreeSeats,
  },
  {
    id: "J",
    name: "Shared Field",
    note: "The most abstract option. Distinct segments participate in one field while the center remains open and unresolved.",
    Mark: MarkSharedField,
  },
];

const mediatorRound = [
  {
    id: "K",
    name: "Facilitated Ring",
    note: "Closest to Scott's edit. The Mediator has a distinct span while the Parties remain equal in weight and placement.",
    Mark: MarkFacilitatedRing,
  },
  {
    id: "L",
    name: "Quiet Guide",
    note: "The Mediator occupies less visual weight, suggesting facilitation rather than authority. This may become fragile at favicon size.",
    Mark: MarkQuietGuide,
  },
  {
    id: "M",
    name: "Open Seat",
    note: "The table is explicit, the Parties are solid, and the Mediator is outlined. The role distinction is clear without changing position or color.",
    Mark: MarkOpenSeat,
  },
  {
    id: "N",
    name: "Mediation Notch",
    note: "A single shared table is interrupted by a narrow Mediator axis. The fewest components, but also the most abstract role reading.",
    Mark: MarkMediationNotch,
  },
];

const thresholdRound = [
  {
    id: "R",
    name: "Open Channel",
    note: "The inner edges widen around a central passage. The Mediator exists entirely as the room held between the Parties.",
    Mark: MarkOpenChannel,
  },
  {
    id: "S",
    name: "Third Lens",
    note: "Two continuous Party forms carve out a lens-like third presence. It is distinct, centered, and never becomes another object.",
    Mark: MarkThirdLens,
  },
  {
    id: "T",
    name: "Quiet Seat",
    note: "A restrained horizontal opening gives the central interval a seat-like posture. More structural than figurative, but fragile when very small.",
    Mark: MarkQuietSeat,
  },
];

const colors = [
  { name: "Ink", value: "#17211F", className: styles.ink },
  { name: "Paper", value: "#F2EFE7", className: styles.paper },
  { name: "Chalk", value: "#FBFAF6", className: styles.chalk },
  { name: "Verdigris", value: "#17685E", className: styles.verdigris },
  { name: "Copper", value: "#B86243", className: styles.copper },
  { name: "Slate", value: "#66736F", className: styles.slate },
];

const allStudies = [...studies, ...secondRound, ...commonTableRound, ...mediatorRound, ...thresholdRound];

export default function BrandPage() {
  return (
    <LogoSelectionProvider>
    <main className={`${styles.page} ${sourceSerif.variable}`}>
      <nav className={styles.nav} aria-label="Brand study navigation">
        <Link className={styles.homeLink} href="/">
          <MarkThreshold className={styles.navMark} label="Obversa" />
          <span>Obversa</span>
        </Link>
        <div className={styles.navMeta}>
          <span>Visual identity study</span>
          <span>Preliminary</span>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>A working visual language</p>
          <h1>Two perspectives.<br />One deliberate room.</h1>
          <p>
            A preliminary identity study for Obversa. Nothing on this page is approved yet.
          </p>
        </div>
        <HeroArtifact
          className={styles.heroArtifact}
          ids={allStudies.map(({ id }) => id)}
          markClassName={styles.heroMarkSlot}
          names={allStudies.map(({ name }) => name)}
          taglineClassName={styles.tagline}
          wordmarkClassName={styles.heroWordmark}
        >
          {allStudies.map(({ id, name, Mark }) => (
            <Mark className={styles.heroMark} key={id} label={`${name} symbol study`} />
          ))}
        </HeroArtifact>
      </header>

      <section className={styles.symbolSection} aria-labelledby="symbol-heading">
        <div className={styles.sectionIntro}>
          <h2 id="symbol-heading">Four ways into the same idea</h2>
          <p>
            Each study keeps the Parties distinct. The interval between them does the conceptual work.
          </p>
        </div>
        <div className={styles.studyGrid}>
          {studies.map(({ id, name, note, Mark }) => (
            <article className={styles.study} key={id}>
              <LogoChoice className={styles.studyCanvas} id={id} name={name}>
                <Mark className={styles.studyMark} />
              </LogoChoice>
              <div className={styles.studyCopy}>
                <span className={styles.studyId}>{id}</span>
                <h3>{name}</h3>
                <p>{note}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.secondRoundSection} aria-labelledby="second-round-heading">
        <div className={styles.secondRoundIntro}>
          <p>Second round</p>
          <h2 id="second-round-heading">Less pill. More process.</h2>
          <span>
            The palette and type remain fixed. These studies change only the symbol logic.
          </span>
        </div>
        <div className={styles.secondRoundGrid}>
          {secondRound.map(({ id, name, note, Mark }) => (
            <article className={styles.secondStudy} key={id}>
              <LogoChoice className={styles.secondCanvas} id={id} name={name}>
                <Mark className={styles.secondMark} />
              </LogoChoice>
              <div className={styles.secondCopy}>
                <span>{id}</span>
                <h3>{name}</h3>
                <p>{note}</p>
                <div className={styles.miniLockup}>
                  <Mark className={styles.miniMark} label={`${name} small-size study`} />
                  <strong>Obversa</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.tableRoundSection} aria-labelledby="table-round-heading">
        <div className={styles.tableRoundIntro}>
          <p>Common Table studies</p>
          <h2 id="table-round-heading">Three roles. Shared attention.</h2>
          <span>
            No side faces another. Each participant is oriented toward a common process, with no promise that the center must close.
          </span>
        </div>
        <div className={styles.tableRoundGrid}>
          {commonTableRound.map(({ id, name, note, Mark }) => (
            <article className={styles.tableStudy} key={id}>
              <LogoChoice className={styles.tableCanvas} id={id} name={name}>
                <Mark className={styles.tableMark} />
              </LogoChoice>
              <div className={styles.tableCopy}>
                <span>{id}</span>
                <h3>{name}</h3>
                <p>{note}</p>
                <div className={styles.tableScale}>
                  {[48, 24, 16].map((size) => (
                    <Mark
                      className={styles[`tableMark${size}`]}
                      key={size}
                      label={`${name} at ${size} pixels`}
                    />
                  ))}
                  <strong>Obversa</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.mediatorRoundSection} aria-labelledby="mediator-round-heading">
        <div className={styles.mediatorRoundIntro}>
          <p>Role distinction</p>
          <h2 id="mediator-round-heading">At the table, not above it.</h2>
          <span>
            These studies keep the Parties equivalent while giving the Mediator a different visual role through span, weight, openness, or interruption.
          </span>
        </div>
        <div className={styles.mediatorRoundGrid}>
          {mediatorRound.map(({ id, name, note, Mark }) => (
            <article className={styles.mediatorStudy} key={id}>
              <LogoChoice className={styles.mediatorCanvas} id={id} name={name}>
                <Mark className={styles.mediatorMark} />
              </LogoChoice>
              <div className={styles.mediatorCopy}>
                <span>{id}</span>
                <h3>{name}</h3>
                <p>{note}</p>
                <div className={styles.mediatorLockup}>
                  <Mark className={styles.mediatorMini} label={`${name} small-size study`} />
                  <strong>Obversa</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.thresholdRoundSection} aria-labelledby="threshold-round-heading">
        <div className={styles.thresholdRoundIntro}>
          <p>Negative-space studies</p>
          <h2 id="threshold-round-heading">The third is the space between.</h2>
          <span>
            The Parties remain the only drawn forms. Their inner edges make the Mediator legible as a held space rather than a third object.
          </span>
        </div>
        <div className={styles.thresholdCompare}>
          <article className={styles.thresholdControl}>
            <LogoChoice className={styles.thresholdCanvas} id="A" name="Threshold">
              <MarkThreshold className={styles.thresholdMark} />
            </LogoChoice>
            <span>A</span>
            <h3>Threshold, control</h3>
            <p>Two solid faces, a closed outer silhouette, and no explicit Mediator.</p>
          </article>
          {thresholdRound.map(({ id, name, note, Mark }) => (
            <article className={styles.thresholdCandidate} key={id}>
              <LogoChoice className={styles.thresholdCanvas} id={id} name={name}>
                <Mark className={styles.thresholdMark} />
              </LogoChoice>
              <span>{id}</span>
              <h3>{name}</h3>
              <p>{note}</p>
              <div className={styles.thresholdLockup}>
                <Mark className={styles.thresholdMini} label={`${name} small-size study`} />
                <strong>Obversa</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.scaleSection} aria-labelledby="scale-heading">
        <div className={styles.scaleCopy}>
          <h2 id="scale-heading">The mark has to survive work</h2>
          <p>A symbol is useful only if it remains legible in the application, documentation, and a browser tab.</p>
        </div>
        <div className={styles.scaleRail}>
          {[128, 64, 32, 16].map((size) => (
            <div className={styles.scaleItem} key={size}>
              <MarkThreshold className={styles[`mark${size}`]} label={`Threshold symbol at ${size} pixels`} />
              <span>{size}px</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.typeSection} aria-labelledby="type-heading">
        <div className={styles.typeDisplay}>
          <h2 id="type-heading">Source Serif 4</h2>
          <p className={styles.serifSpecimen}>Difficult conversations resist simple scripts.</p>
          <p className={styles.serifAlphabet}>Aa Bb Cc Dd Ee Ff Gg 0123456789</p>
        </div>
        <div className={styles.typeInterface}>
          <h3>Geist Sans</h3>
          <p className={styles.sansSpecimen}>Each Party holds its own facts, limits, and view of the Session.</p>
          <div className={styles.interfaceLabels}>
            <span>Joint Session</span>
            <span>Private Caucus</span>
            <span>Offer pending</span>
          </div>
          <p className={styles.monoSpecimen}>EVENT 018 / MEDIATOR + PARTY A / 14:32</p>
        </div>
      </section>

      <section className={styles.paletteSection} aria-labelledby="palette-heading">
        <h2 id="palette-heading">Mineral, not digital</h2>
        <div className={styles.swatches}>
          {colors.map((color) => (
            <div className={styles.swatch} key={color.name}>
              <div className={`${styles.swatchColor} ${color.className}`} />
              <strong>{color.name}</strong>
              <span>{color.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.applicationSection} aria-labelledby="application-heading">
        <div className={styles.applicationCopy}>
          <h2 id="application-heading">A quieter working surface</h2>
          <p>
            The brand can carry texture. A live Session should carry only what helps the Mediator read the room.
          </p>
        </div>
        <div className={styles.sessionSample}>
          <div className={styles.sessionHeader}>
            <div>
              <span>Boundary dispute</span>
              <strong>Joint Session</strong>
            </div>
            <span className={styles.audience}>Visible to all</span>
          </div>
          <div className={styles.eventPartyA}>
            <span>Party A</span>
            <p>I can discuss access, but the proposed schedule still leaves the loading area blocked.</p>
          </div>
          <div className={styles.eventMediator}>
            <span>Mediator</span>
            <p>What would a workable access window need to protect for each of you?</p>
          </div>
          <div className={styles.eventPartyB}>
            <span>Party B</span>
            <p>I need predictable morning access. The exact start time is less important.</p>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div>
          <MarkThreshold className={styles.footerMark} label="Obversa" />
          <span>Obversa</span>
        </div>
        <p>Preliminary study. Built to be challenged.</p>
      </footer>
    </main>
    </LogoSelectionProvider>
  );
}
