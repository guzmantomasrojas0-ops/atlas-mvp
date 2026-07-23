export interface LayoutEvent {
  id: string;
  startMinutes: number;
  endMinutes: number;
}

export interface EventLayout {
  id: string;
  lane: number;
  laneCount: number;
}

function overlaps(a: LayoutEvent, b: LayoutEvent): boolean {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

/** Agrupa eventos en clusters de solapamiento transitivo (A-B y B-C solapan => van juntos, aunque A-C no solapen). */
function computeClusters(events: LayoutEvent[]): LayoutEvent[][] {
  const clusters: LayoutEvent[][] = [];
  for (const event of events) {
    const matching = clusters.filter((cluster) => cluster.some((e) => overlaps(e, event)));
    if (matching.length === 0) {
      clusters.push([event]);
      continue;
    }
    const merged = matching.flat();
    merged.push(event);
    for (const cluster of matching) {
      clusters.splice(clusters.indexOf(cluster), 1);
    }
    clusters.push(merged);
  }
  return clusters;
}

/** Empaquetado tipo Google Calendar: cada evento a la primer "carril" libre; si no hay, abre uno nuevo. */
function assignLanes(cluster: LayoutEvent[]): { laneOf: Map<string, number>; laneCount: number } {
  const sorted = [...cluster].sort((a, b) => a.startMinutes - b.startMinutes);
  const laneEnds: number[] = [];
  const laneOf = new Map<string, number>();

  for (const event of sorted) {
    const freeLane = laneEnds.findIndex((end) => end <= event.startMinutes);
    const lane = freeLane === -1 ? laneEnds.length : freeLane;
    laneEnds[lane] = event.endMinutes;
    laneOf.set(event.id, lane);
  }

  return { laneOf, laneCount: laneEnds.length };
}

/**
 * Calcula, para un conjunto de eventos en una misma columna del calendario,
 * qué "carril" (lane) le toca a cada uno y cuántos carriles necesita su
 * cluster — para poder renderizarlos lado a lado sin superponerse
 * visualmente cuando coinciden en el tiempo.
 */
export function computeEventLayout(events: LayoutEvent[]): EventLayout[] {
  const clusters = computeClusters(events);
  const result: EventLayout[] = [];

  for (const cluster of clusters) {
    const { laneOf, laneCount } = assignLanes(cluster);
    for (const event of cluster) {
      result.push({ id: event.id, lane: laneOf.get(event.id) ?? 0, laneCount });
    }
  }

  return result;
}
