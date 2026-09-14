"use client";

import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowRight, Dot } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { marketingSlides } from "@/components/marketing/marketing-slides";

import styles from "./marketing-homepage.module.css";

export function MarketingHomepage() {
  const [autoplay] = useState(() =>
    Autoplay({
      delay: 4800,
      playOnInit: false,
      stopOnFocusIn: true,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    }),
  );
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [autoplay]);

  useEffect(() => {
    if (!emblaApi) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncAutoplay = () => {
      const carouselRoot = emblaApi.rootNode();
      const interactionPaused = carouselRoot.matches(":hover") || carouselRoot.contains(document.activeElement);

      if (reducedMotion.matches || interactionPaused) {
        autoplay.stop();
      } else {
        autoplay.play();
      }
    };

    syncAutoplay();
    reducedMotion.addEventListener("change", syncAutoplay);

    return () => {
      reducedMotion.removeEventListener("change", syncAutoplay);
      autoplay.stop();
    };
  }, [autoplay, emblaApi]);

  function resumeAutoplayAfterFocus(carouselRoot: HTMLElement) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion && !carouselRoot.matches(":hover")) {
      autoplay.play();
    }
  }

  return (
    <div className={styles.page}>
      <AppHeader />

      <main className="relative z-10 flex min-h-[calc(100dvh-var(--app-header-height))] w-full items-center px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
        <div className="grid w-full gap-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:items-center">
        <section className="min-w-0 max-w-xl">
          <h1 className="text-[2.8rem] font-black uppercase leading-[0.94] tracking-[-0.05em] sm:text-[3.7rem] lg:text-[4.75rem]">
            Everyone has something to say
          </h1>
          <ul className="mt-6 max-w-lg list-none p-0 text-base leading-7 text-[var(--marketing-muted)] sm:text-lg sm:leading-8" role="list">
            {[
              "Build a survey with AI",
              "Share the link",
              "Guide agent to create a report.",
            ].map((text) => (
              <li className="flex items-start gap-1" key={text}>
                <Dot className="mt-0.5 size-6 shrink-0 text-[var(--marketing-accent)] sm:mt-1" aria-hidden="true" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <Link className={`${styles.button} ${styles.shimmerButton} mt-8`} href="/start?next=%2Fdashboard">
            <span className={styles.shimmerTrack} aria-hidden="true">
              <span className={styles.shimmerSlide}>
                <span className={styles.shimmerSpark} />
              </span>
            </span>
            <span className={styles.shimmerBackdrop} aria-hidden="true" />
            Get started <ArrowRight className={`size-4 ${styles.shimmerArrow}`} aria-hidden="true" />
          </Link>
  <p className="mt-8 text-sm font-medium leading-7 text-[var(--marketing-muted)] sm:text-base">
  <span className="block">Agents for humans! Built with{" "}
      <span className="relative inline-flex font-semibold text-[var(--marketing-ink)]">
        <span className="absolute inset-x-0 bottom-0 h-2 rounded-full bg-[var(--marketing-highlight)]" aria-hidden="true" />
        <span className="relative">AWS Strands</span>
      </span>  Agents SDK.
    </span>
  </p>
        </section>

        <section
          className={styles.mediaFrame}
          aria-label="How Saywide works. Rotating three-slide preview; focus or hover to pause."
          aria-roledescription="carousel"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) resumeAutoplayAfterFocus(event.currentTarget);
          }}
          onFocus={() => autoplay.stop()}
          ref={emblaRef}
        >
          <div
            className={styles.container}
            data-carousel-track
            aria-label="Carousel slides. Focus to pause automatic rotation."
            aria-live="off"
            tabIndex={0}
          >
            {marketingSlides.map((slide, index) => (
              <article
                className={styles.slide}
                key={slide.number}
                aria-label={`${index + 1} of ${marketingSlides.length}`}
                aria-roledescription="slide"
                role="group"
              >
                {slide.image ? (
                  <Image
                    alt={slide.image.alt}
                    className={styles.image}
                    fill
                    sizes="(min-width: 1024px) calc(60.87vw - 54px), (min-width: 640px) calc(100vw - 60px), calc(100vw - 44px)"
                    src={slide.image.src}
                  />
                ) : (
                  <div className={styles.placeholder} aria-hidden="true">
                    <span className={styles.placeholderNumber}>{slide.number}</span>
                  </div>
                )}
                <div className={styles.overlay}>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">{slide.label}</p>
                  <h2 className="mt-2 max-w-xl text-2xl font-bold tracking-[-0.035em] sm:text-3xl">{slide.headline}</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 opacity-85 sm:text-base sm:leading-7">{slide.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        </div>
      </main>
    </div>
  );
}
