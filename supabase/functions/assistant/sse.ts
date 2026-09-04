// P8-03 — the wire format of a streamed answer: one `event:` name and one JSON
// `data:` line per frame, blank line between frames, as EventSource defines it.
// The Ask page reads it with `fetch` rather than EventSource, because the
// request is a POST with a bearer token.

const encoder = new TextEncoder()

export type SseEvent = 'delta' | 'sources' | 'done' | 'error'

export function frame(event: SseEvent, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/** A comment line: keeps an idle proxy from closing the stream during a tool loop. */
export function heartbeat(): Uint8Array {
  return encoder.encode(': ping\n\n')
}
