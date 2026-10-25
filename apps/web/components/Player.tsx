"use client";

import { PLAYERS, playerSrc, type Facts } from "@pluck/shared-schemas";
import { useTranslations } from "next-intl";
import { useState } from "react";
import styles from "./Player.module.css";

// A video or episode that plays here. Nothing loads from the provider (no frame, no cookies) until Play is pressed;
// then its player loads from an address built from an allowed id, with the origin as Referer, as YouTube requires.
export function Player({ facts, title, site, cover }: { facts: Facts; title: string; site: string; cover: string | null }) {
  const t = useTranslations("app.preview");
  const [on, setOn] = useState(false);
  const src = playerSrc(facts);
  if (!src || !facts.player) return null;
  const ratio = facts.vertical ? 9 / 16 : PLAYERS[facts.player.provider].ratio;
  const bar = ratio === 0; // an audio bar, not a picture
  return (
    <figure className={styles.player}>
      <div className={bar ? styles.bar : styles.frame} style={bar ? undefined : { aspectRatio: String(ratio), maxWidth: facts.vertical ? 360 : undefined }}>
        {on ? (
          <iframe
            src={src}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            className={styles.iframe}
          />
        ) : (
          <button type="button" className={styles.poster} onClick={() => setOn(true)} aria-label={t("playA11y", { title })}>
            {cover && !bar && <img src={cover} alt="" className={styles.image} />}
            <span className={styles.play} aria-hidden>
              <svg width="22" height="22" viewBox="0 0 16 16"><path d="M5 3.5v9l7.5-4.5z" fill="currentColor" /></svg>
            </span>
            {bar && <span className={styles.barTitle}>{title}</span>}
          </button>
        )}
      </div>
      {!on && <figcaption className={styles.note}>{t("playNote", { site })}</figcaption>}
    </figure>
  );
}
