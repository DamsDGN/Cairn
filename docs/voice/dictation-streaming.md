# Dictation by sentence

Design note for M14, phase D. Nothing here is implemented yet.

## Goal

Dictation should feel like writing while speaking: each finished sentence appears while the next one
is being spoken. Target: no more than two seconds between the end of a sentence and its text, for
sentences up to five seconds, on the reference machine with the AVX2 addon. Today the whole
recording is transcribed after the stop button, so a thirty-second thought costs a single wait.

## Why not streaming from whisper

whisper.cpp encodes a thirty-second window as one block and decodes it autoregressively. `onNewSegments`
reports segments as the decoder produces them, but the encoder has already run over the whole window,
so on short clips it saves nothing. Sentence-level batching is the only way to overlap speaking and
transcribing with this engine.

## Recording

`recorder.ts` currently uses a `ScriptProcessorNode`, which runs on the main thread and copies every
block into an array. Replace it with an `AudioWorkletProcessor`:

- 128-frame blocks at 16 kHz, accumulated into 20 ms frames.
- Per frame, the worklet computes the RMS level and posts `{ samples, rms }` to the page.
- The page keeps a ring buffer of the last 300 ms and never blocks on the audio graph.

The worklet only reports levels; all decisions stay in the page, where they are testable.

## Finding sentence boundaries

Energy thresholds with hysteresis, calibrated on the first 300 ms of the recording (assumed silence
before the user starts talking):

- Noise floor `n` is the median frame RMS of that window.
- Speech starts when a frame exceeds `max(0.02, n * 4)` for 150 ms.
- A sentence ends after 700 ms below `max(0.012, n * 2)`.
- The first 250 ms before speech start and the last 300 ms after the end are kept, so quiet
  consonants are not clipped.

The segmenter is a pure function over the sequence of frame levels, so its contracts are unit tests
with synthetic series: a single sentence, several sentences, a cough shorter than the minimum speech
duration, background noise above the low threshold, and a sentence that reaches the thirty-second
cap.

## Confirming with the detector

A cough or a door can pass the energy test. Before transcribing a sentence, the main process runs the
Silero detector over that sentence only (it is already installed for the whole-recording path). If it
finds no speech, the sentence is dropped silently. This costs a few milliseconds per sentence and
keeps the recognizer away from noise, where it invents text.

## Transcribing

- One queue in the main process, one whisper task at a time on the shared context. A second call on
  the same context would corrupt its state.
- Every sentence carries a sequence number and its start offset.
- Results are delivered in order: a later sentence that finishes first waits for its predecessor, so
  the text is never reordered.
- Cancelling (Escape, stop button, window closing) sets a generation counter, calls `stop()` on the
  running task, empties the queue, and drops every result whose generation is stale.
- A sentence longer than thirty seconds is cut at the cap; the remainder continues as a new sentence.
- Recording stops on its own after two minutes, as today.

## Inserting

Each finished sentence is inserted where the caret is at that moment, with a space when the text
before it does not end with one. This is what the user expects after they moved the caret; the
alternative, remembering the original position, would insert text behind their back.

The composer shows the sentences as they arrive, so the perceived latency is one sentence, not one
recording.

## States

`idle → recording → transcribing(n) → idle`, plus `error` for a microphone failure and `cancelled`
for Escape. The button shows the number of sentences waiting so a slow machine looks busy rather than
stuck. Losing one sentence (transcription error, detector rejection) shows a discreet toast and the
session continues.

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
