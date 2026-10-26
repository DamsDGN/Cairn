# Dictation by sentence

Design note for M14, phase D. Implemented.

## Goal

Dictation should feel like writing while speaking: each finished sentence appears while the next one
is being spoken. Target: no more than two seconds between the end of a sentence and its text, for
sentences up to five seconds, on the reference machine with the AVX2 addon. Before this change the
whole recording was transcribed after the stop button, so a thirty-second thought cost a single
wait.

## Why not streaming from whisper

whisper.cpp encodes a thirty-second window as one block and decodes it autoregressively. `onNewSegments`
reports segments as the decoder produces them, but the encoder has already run over the whole window,
so on short clips it saves nothing. Sentence-level batching is the only way to overlap speaking and
transcribing with this engine.

## Recording

`recorder.ts` keeps the `ScriptProcessorNode` the recorder already used: it runs on the main thread
and copies every block into an array. Each 4096-sample block is cut into 20 ms frames and reported
with the root mean square level of the frame. Moving the frame loop into an `AudioWorkletProcessor`
would take it off the main thread, but the worklet cannot be tested in the current harness and the
measured CPU cost of the page-side loop is negligible, so it stays a later optimization.

The full recording remains in memory while recording, capped by the existing two-minute limit. The
segmenter reports offsets into that recording and `sliceSamples` copies a sentence out of it just
before transcription.

## Finding sentence boundaries

`segmenter.ts` is a pure state machine over frame levels, calibrated on the first 300 ms of the
recording (assumed silence before the user starts talking):

- Noise floor `n` is the median frame RMS of that window, capped at `0.02` so a recording that
  starts mid-sentence does not raise the threshold.
- Speech starts when a frame exceeds `max(0.02, n * 4)` for 150 ms.
- A sentence ends after 700 ms below `max(0.012, n * 2)`.
- A segment needs at least 300 ms of speech.
- The first 250 ms before speech start and the last 300 ms after the end are kept, so quiet
  consonants are not clipped.
- A sentence longer than thirty seconds is cut at the cap; the remainder continues as a new
  sentence.

The contracts are unit tests with synthetic series: a single sentence, several sentences, a cough
shorter than the minimum speech duration, background noise above the low threshold, and a sentence
that reaches the thirty-second cap.

## Confirming with the detector

A cough or a door can pass the energy test. Before transcribing a sentence, the main process runs the
Silero detector over that sentence only. If it finds no speech, the sentence is dropped silently.
This costs a few milliseconds per sentence and keeps the recognizer away from noise, where it invents
text.

## Transcribing

- One queue in the renderer, one whisper task at a time on the shared context. A second call on the
  same context would corrupt its state, so the main process also serializes its own tasks.
- Results are delivered in order: a later sentence that finishes first waits for its predecessor, so
  the text is never reordered.
- Cancelling (Escape, stop button, window closing) sets a generation counter, empties the queue and
  drops every result whose generation is stale.
- Recording stops on its own after two minutes, as before.

## Inserting

Each finished sentence is appended to the composer with a space when the text before it does not end
with one, and focus returns to the editor. Appending rather than remembering a caret position keeps
the text where the user is looking; whisper cannot revise an earlier guess, so insertion is
append-only within a dictation.

The composer shows the sentences as they arrive, so the perceived latency is one sentence, not one
recording.

## States

`idle → recording → transcribing(n) → idle`, plus `error` for a microphone or transcription failure.
The button shows a transcribing label while sentences are queued, so a slow machine looks busy rather
than stuck.

## What is not in scope

- Partial words or live hypotheses: whisper cannot revise its output as audio arrives.
- Voice commands ("new paragraph", "send").
- A separate language per sentence.

## Measurements to take after implementation

- Perceived latency per sentence on the reference clip (speech end to first character on screen), at
  one, four and eight threads.
- Total time for a thirty-second dictation, end to end.
- Event-loop delay during the queue, as in the AVX2 diagnosis.
- Behaviour with the detector missing (energy only), as a fallback path.
