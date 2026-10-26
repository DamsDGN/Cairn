# Voice conversation

Design note for M14, phase E. Implemented on desktop.

## Goal

A call mode that feels like talking to the assistant: the user speaks, Cairn answers out loud, and
the user can speak again as soon as they want. Everything runs on the user's machine; Cairn is a
standalone application and does not depend on the Sover stack or any remote speech endpoint.

## Pipeline

1. The recorder reports 20 ms frames with their RMS level.
2. The segmenter from dictation finds the end of the user's sentence.
3. The main process transcribes the sentence with the installed whisper model and the Silero
   detector.
4. The text is appended to the composer and submitted to the current session.
5. The assistant answer is read from the session messages as it streams, split into sentences, and
   each sentence is synthesized and played.

Synthesis uses `sherpa-onnx-node` with the Piper French voice
`vits-piper-fr_FR-siwis-medium`. The voice archive (67 MB) is downloaded on request like the
whisper models and extracted into `<userData>/voice/models`; the engine reads the ONNX model and
the `espeak-ng-data` folder shipped in the archive. Synthesis runs in the main process, serialized
like transcription, and hands signed 16-bit mono PCM to the renderer, which plays it through Web
Audio. No audio leaves the machine. The engine allocates its samples outside the V8 heap by
default, which the main process rejects, so synthesis asks sherpa-onnx for a copy: the flag costs a
few hundred microseconds per sentence and keeps playback working inside Electron.

## Voices

Cairn ships no voice in the installer. Settings > Voice offers a language, French or English, and
the voices published for it, each downloaded once and kept in `<userData>/voice/models`: siwis,
UPMC and Coqui for French, Lessac, Ryan and Alba for English. The chosen voice is stored in the
voice preferences, and a call only speaks with that one, so switching language never answers in the
other one. Each installed voice carries a Listen action that reads one sentence with it, which is
how a voice gets chosen.

The voices are Piper and Coqui VITS models; every one runs at a real-time factor below 0.1 on the
reference machine, so a sentence is ready before the previous one finishes playing.

## Half duplex

The call listens, thinks, speaks, then listens again. While Cairn speaks, the first four frames
above 0.04 RMS (about 80 ms) stop the playback and end the turn: immediately when the answer was
already fully written, or once the run still producing it finishes. Speaking over the answer is
faster than finding a button, and it is what people do on a phone call.

While Cairn is thinking, incoming speech is ignored rather than queued. Queueing it would make the
assistant answer a sentence the user has already moved past. The exception is the sentence that
interrupted an answer that was still streaming: it is kept and submitted once that run finishes, so
speaking over Cairn still becomes the next turn.

## Permissions

A permission request cannot be answered by voice. When the session has a pending request, the call
ends and a toast points the user to the conversation, where the request stays on screen. The same
applies to forms.

## Model requirements

The call needs a speech model for the microphone and the French Piper voice for the answer. If
either is missing, the dialog says so and links to Settings > Voice. Models are never bundled, so a
fresh profile explains the download instead of failing silently.

## Limits

- One turn at a time; there is no streaming partial transcription.
- The answer is spoken sentence by sentence as it arrives; a sentence is at most one synthesis
  request.
- Markdown is stripped before synthesis so the voice never reads asterisks or link syntax, and code
  blocks are announced ("Bloc de code TypeScript.") instead of being read line by line.
- The call ends on close, on the microphone error, and on the permission request.
- Barge-in stops playback but does not cancel the model run that produced it. The stale answer is no
  longer spoken and its text stays in the conversation; the interrupting sentence is submitted once
  that run ends.
