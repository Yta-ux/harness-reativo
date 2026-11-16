import { Observable, Subject } from "rxjs";
import type { DomainEvent } from "./events";

/**
 * The single place where a Subject lives. Consumers only see an Observable
 * (the stream); producers only see `emit` (the sink).
 */
export class EventBus {
  private readonly subject = new Subject<DomainEvent>();

  readonly events$: Observable<DomainEvent> = this.subject.asObservable();

  emit(event: DomainEvent): void {
    this.subject.next(event);
  }
}
