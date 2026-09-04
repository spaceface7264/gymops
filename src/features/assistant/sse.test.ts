import { describe, expect, it } from 'vitest'
import { parseSse } from './sse'

describe('parseSse', () => {
  it('reads one complete frame', () => {
    expect(parseSse('event: delta\ndata: {"text":"Hi"}\n\n')).toEqual({
      events: [{ event: 'delta', data: '{"text":"Hi"}' }],
      rest: '',
    })
  })

  it('reads two frames that arrived in one chunk', () => {
    const { events } = parseSse(
      'event: delta\ndata: {"text":"A"}\n\nevent: done\ndata: {"id":1}\n\n',
    )
    expect(events.map((event) => event.event)).toEqual(['delta', 'done'])
  })

  it('keeps a frame that was cut mid-line for the next chunk', () => {
    const first = parseSse('event: delta\ndata: {"te')
    expect(first.events).toEqual([])
    expect(first.rest).toBe('event: delta\ndata: {"te')

    const second = parseSse(first.rest + 'xt":"A"}\n\n')
    expect(second).toEqual({
      events: [{ event: 'delta', data: '{"text":"A"}' }],
      rest: '',
    })
  })

  it('ignores comment lines, which is what a heartbeat is', () => {
    expect(parseSse(': ping\n\nevent: delta\ndata: {"text":"A"}\n\n').events).toEqual([
      { event: 'delta', data: '{"text":"A"}' },
    ])
  })

  it('ignores a frame with no event name', () => {
    expect(parseSse('data: {"text":"A"}\n\n').events).toEqual([])
  })
})
