export type SseFrame = { event: string; data: string }

/**
 * Server-sent events, read by hand: the answer arrives on a POST with a bearer
 * token, which `EventSource` cannot send. Frames end in a blank line; whatever
 * follows the last complete frame is returned as `rest`, to be put in front of
 * the next chunk. Comment lines (the function's heartbeats) and frames without
 * an event name are dropped.
 */
export function parseSse(buffer: string): { events: SseFrame[]; rest: string } {
  const blocks = buffer.split('\n\n')
  const rest = blocks.pop() ?? ''
  const events: SseFrame[] = []

  for (const block of blocks) {
    let event = ''
    const data: string[] = []

    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }

    if (event) events.push({ event, data: data.join('\n') })
  }

  return { events, rest }
}
