# Report animation

Report creation uses four illustrated scenes: gathering responses, finding themes, checking evidence, and writing the report. Each scene stays visible for at least 3 seconds and waits longer if its backend stage is still running. Processing continues independently; the sequence never skips an intermediate scene when polling jumps ahead. Four fast stages take 12 seconds, followed by an 800 ms completion transition. There is no skip action.

The duration is defined by `REPORT_STAGE_MIN_MS` in `frontend/src/lib/report-presentation.ts`. New report creation records a pending presentation before navigating, including when the API has already completed the report. Observed running reports also record this marker. It survives reloads in the same tab until the presentation finishes. Previously completed reports without a pending presentation open normally. Failure and status-fetch errors stop the animation immediately; retrying a status fetch restarts the presentation. No backend delays or additional model calls are introduced.

Animations are decorative: the cards, connections, and chart bars do not represent actual findings or counts. The expandable activity history continues to show real backend events. Reduced-motion preferences disable illustration and transition motion while preserving the same stage sequence and timing.

## Local rehearsal

Start the frontend development server and open `/preview/report-progress`. The preview lets you inspect each scene or play the full sequence without calling the report API. Its controls are only available in development; production builds return 404 for this route.

Below the animation, the same Agent activity component used on report pages shows sample events for the selected stage and all preceding stages. It starts expanded for inspection and can be collapsed. Sample calls, checks, timestamps, and durations are illustrative; no agent is invoked. Playing the sequence adds events as the stages advance, and replay resets the list.

## Verification

- Unit tests cover five-second and immediate completion, long stages, repeated or stale progress, unmount/failure cleanup, and storage-disabled creation.
- Check the real create-report flow with immediate completion: all four steps must appear before the report is revealed.
- Check a long analysis stage and ensure later scenes wait for confirmed progress.
- Check failure and status retry while a scene is running.
- Check desktop and narrow mobile layouts, plus reduced motion.
- Reopen a revealed report and ensure it opens directly.
