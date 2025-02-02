declare module "@hoge1e3/events" {
    export type Remover={
        remove:Function,
    };
    export class EventHandler {
        on(type: string, handler: Function): Remover;
        fire(type: string, arg: any): void;
    }
}