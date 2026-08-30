import type { Metadata } from "next";
import Link from "next/link";
import { Source_Serif_4 } from "next/font/google";

import {
  getComplexity,
  getMediatorResources,
  getSharedPremise,
  scenarios,
} from "@/src/scenarios/catalog";

import styles from "./page.module.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Obversa | Mediation rehearsal",
  description: "Rehearse difficult mediations with independent simulated Parties.",
};

type MarkProps = { className?: string; label?: string };

function ThirdLens({ className, label = "Obversa" }: MarkProps) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label={label}>
      <path d="M18 80c0-31 22-57 54-63v31c0 12-4 23-12 32 8 9 12 20 12 32v31c-32-6-54-32-54-63Z" fill="currentColor" />
      <path d="M142 80c0-31-22-57-54-63v31c0 12 4 23 12 32-8 9-12 20-12 32v31c32-6 54-32 54-63Z" fill="currentColor" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className={`${styles.page} ${sourceSerif.variable}`}>
      <nav className={styles.nav} aria-label="Primary navigation">
        <Link className={styles.brand} href="/">
          <ThirdLens className={styles.navMark} />
          <span>Obversa</span>
        </Link>
        <div className={styles.navLinks}>
          <Link href="#scenarios">Scenarios</Link>
          <Link className={styles.navAction} href="#scenarios">Begin a rehearsal</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Mediation rehearsal</p>
          <h1>Rehearse what cannot be scripted.</h1>
          <p className={styles.heroLead}>
            Practice difficult mediations with independent simulated Parties. Each holds its own facts, limits, and view of the Session.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="#scenarios">Choose a Scenario</Link>
            <Link className={styles.textAction} href="#how-it-works">See how it works <span aria-hidden="true">↓</span></Link>
          </div>
          <p className={styles.alphaNote}>Closed alpha. Use synthetic material only.</p>
        </div>

        <div className={styles.heroArtifact}>
          <div className={styles.markField}>
            <ThirdLens className={styles.heroMark} label="Third Lens symbol: two Parties defining a held space" />
          </div>
          <p>Two perspectives remain distinct. The process holds the room between them.</p>
        </div>
      </header>

      <section className={styles.mechanism} id="how-it-works" aria-labelledby="mechanism-heading">
        <div className={styles.sectionHeading}>
          <p>What changes in the room</p>
          <h2 id="mechanism-heading">Two Parties should be more than one chatbot wearing two name tags.</h2>
        </div>
        <div className={styles.mechanismGrid}>
          <article className={styles.mechanismLead}>
            <span>01</span>
            <h3>Independent perspectives</h3>
            <p>Each Party receives separate private facts, constraints, and behavioral context. Neither can see what the other has not disclosed.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Real process boundaries</h3>
            <p>Move between Joint Session and Caucus. Every Event declares who can observe it before it enters a Party&apos;s view.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Your judgment stays in the chair</h3>
            <p>Obversa does not prescribe the correct intervention or promise an outcome. Review the Session, then decide what you would carry forward.</p>
          </article>
        </div>
      </section>

      <section className={styles.scenarioSection} id="scenarios" aria-labelledby="scenario-heading">
        <div className={styles.scenarioIntro}>
          <div>
            <p>Available now</p>
            <h2 id="scenario-heading">Choose the dispute, then meet the Parties.</h2>
          </div>
          <p>These closed-alpha Scenarios use synthetic materials. Do not enter real case files, privileged material, or confidential client information.</p>
        </div>

        <div className={styles.scenarioList}>
          {scenarios.map((scenario, index) => {
            const resources = getMediatorResources(scenario);
            return (
              <article className={styles.scenario} key={scenario.scenarioId}>
                <p className={styles.scenarioNumber}>0{index + 1}</p>
                <div className={styles.scenarioCopy}>
                  <div className={styles.scenarioTitleLine}>
                    <h3>{scenario.title}</h3>
                    <span>{scenario.difficulty}</span>
                  </div>
                  <p>{getSharedPremise(scenario)}</p>
                  <ul aria-label="Scenario details">
                    <li>{getComplexity(scenario)}</li>
                    <li>{resources.length} Case {resources.length === 1 ? "resource" : "resources"}</li>
                    {scenario.tags.map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                </div>
                <Link className={styles.scenarioAction} href={`/scenarios/${scenario.slug}`}>
                  Review Scenario <span aria-hidden="true">→</span>
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.boundary} aria-labelledby="boundary-heading">
        <ThirdLens className={styles.boundaryMark} label="Obversa" />
        <div>
          <p>Built for rehearsal, not prediction</p>
          <h2 id="boundary-heading">The Parties are simulated. The professional judgment is yours.</h2>
        </div>
        <p>Obversa is an AGPL-licensed community application in closed alpha. It does not provide legal advice, predict real people, or guarantee mediation outcomes.</p>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.brand} href="/">
          <ThirdLens className={styles.navMark} />
          <span>Obversa</span>
        </Link>
        <p>Rehearse what cannot be scripted.</p>
        <p className={styles.footerMeta}>Closed alpha / AGPL-3.0</p>
      </footer>
    </main>
  );
}
